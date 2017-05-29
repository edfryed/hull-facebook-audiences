import Promise from "bluebird";
import _ from "lodash";
import fbgraph from "fbgraph";

import CAPABILITIES from "./capabilities";
import CustomAudiences from "./custom-audiences";

const ACCOUNT_FIELDS = [
  "id",
  "account_id",
  "name",
  "account_status",
  "owner",
  "capabilities",
  "business",
  "user_role"
];

const AUDIENCE_FIELDS = [
  "account_id",
  "approximate_count",
  "data_source",
  "delivery_status",
  "description",
  "excluded_custom_audiences",
  "external_event_source",
  "included_custom_audiences",
  "lookalike_spec",
  "name",
  "operation_status",
  "opt_out_link",
  "permission_for_actions",
  "pixel_id",
  "retention_days",
  "rule",
  "subtype",
  "time_content_updated",
  "time_created",
  "time_updated"
];

export default class FacebookAudience {

  /**
   * @param  {String} method supports `handleSegmentUpdate` and `handleSegmentDelete`
   * @return {Promise}
   */
  static handle(method) {
    return ({ client, ship, helpers, segments, metric }, { message }) => {
      const handler = new FacebookAudience(ship, client, helpers, segments, metric);
      if (!handler.isConfigured()) {
        const error = new Error("Missing credentials");
        error.status = 403;
        return Promise.reject(error);
      }
      return handler[method](message);
    };
  }

  /**
   * Handles user Update
   * @param  {Object} options.message
   * @param  {Object} options.ship
   * @param  {Object} options.client
   * @param  {Object} options.helpers
   * @param  {Object} options.segments
   */
  static handleUserUpdate({ ship, client, helpers, segments, metric }, { messages = [] }) {
    const agent = new FacebookAudience(ship, client, helpers, segments, metric);
    const filteredMessages = messages.reduce((acc, message) => {
      const { user, changes } = message;

      // Ignore if no changes on users' segments
      if (!user.email || !changes || _.isEmpty(changes.segments)) {
        client.logger.info("outgoing.user.skip", _.merge(
          _.pick(user, "id", "external_id", "email"),
          { reason: "no changes on users segments" }
        ));
        return acc;
      }

      // Reduce payload to keep in memory
      const payload = {
        user: _.pick(user, agent.customAudiences.getExtractFields()),
        changes: _.pick(changes, "segments")
      };

      if (!agent.isConfigured()) {
        client.logger.info("outgoing.user.skip", _.merge(
          _.pick(user, "id", "external_id", "email"),
          { reason: "connector is not configured" }
        ));
        return acc;
      }

      return acc.concat(payload);
    }, []);

    FacebookAudience.flushUserUpdates.call(this, agent, filteredMessages);
  }

  /**
   * Performs actions on users grouped by `handleUserUpdate` method.
   * It only works on segments saved in `synchronized_segments` setting
   * @param  {Object} agent     instance of FacebookAudience
   * @param  {Object} messages
   * @return {Promise}
   */
  static flushUserUpdates(agent, messages) {
    let segments = [];
    const operations = messages.reduce((ops, { user, changes }) => {
      if (changes && changes.segments) {
        const { entered, left } = changes.segments;
        segments = _.union(segments, entered, left);
        (entered || []).forEach(segment => {
          ops[segment.id] = ops[segment.id] || { segment, entered: [], left: [] };
          ops[segment.id].entered.push(user);
        });
        (left || []).forEach(segment => {
          ops[segment.id] = ops[segment.id] || { segment, entered: [], left: [] };
          ops[segment.id].left.push(user);
        });
      }
      return ops;
    }, {});

    return Promise.all(segments.map(s => agent.getOrCreateAudienceForSegment(s)))
      .then(() => agent.fetchAudiences())
      .then(audiences => {
        return Promise.all(_.map(operations, ({ segment, entered, left }) => {
          const audience = audiences[segment.id];
          if (!audience || !_.includes(agent.ship.private_settings.synchronized_segments, segment.id)) {
            return {};
          }
          if (left.length > 0) agent.removeUsersFromAudience(audience.id, left);
          if (entered.length > 0) agent.addUsersToAudience(audience.id, entered);
          return { audience, segment, entered, left };
        }));
      });
  }

  /**
   * Makes sure that the all synchronized segments have corresponding Custom Audiences.
   * While creating new ones, it will requests extracts for them.
   * @return {Promise}
   */
  sync() {
    const segments = this.getSynchronizedSegments();
    return this.fetchAudiences()
      .then((audiences) => {
        return Promise.all(segments.map(segment => {
          return audiences[segment.id] || this.createAudience(segment);
        }));
      });
  }

  getSynchronizedSegments() {
    const segmentSetting = _.get(this.ship.private_settings, "synchronized_segments", []).map(s => {
      return { id: s };
    });
    return _.intersectionBy(this.segments, segmentSetting, "id");
  }

  constructor(ship, client, helpers, segments, metric) {
    this.ship = ship;
    this.client = client;
    this.customAudiences = new CustomAudiences(ship, client.logger);
    this.helpers = helpers;
    this.segments = segments;
    this.metric = metric;
  }

  getAccessToken() {
    return _.get(this.ship, "private_settings.facebook_access_token");
  }

  getAccountId() {
    return _.get(this.ship, "private_settings.facebook_ad_account_id");
  }

  getManagerUrl(audience) {
    return `https://www.facebook.com/ads/manager/audiences/detail/?act=${this.getAccountId()}&pid=p3&ids=${audience.id}`;
  }

  getCredentials() {
    return {
      accessToken: this.getAccessToken(),
      accountId: this.getAccountId()
    };
  }

  isConfigured() {
    const { accessToken, accountId } = this.getCredentials();
    return !!(accessToken && accountId);
  }

  createAudience(segment, extract = true) {
    this.metric.increment("ship.audience.create", 1);
    return this.fb("customaudiences", {
      subtype: "CUSTOM",
      retention_days: 180,
      description: segment.id,
      name: `[Hull] ${segment.name}`
    }, "post").then(audience => {
      if (extract) {
        this.helpers.requestExtract({
          segment,
          fields: this.customAudiences.getExtractFields(),
          additionalQuery: {
            audience: audience.id
          }
        });
      }
      return Object.assign({ isNew: true }, audience);
    });
  }

  /**
   * Creates or returns information about Facebook Audience matching provided segment.
   * In case it gets segment which is not included in the `synchronized_segments`
   * setting it will return null
   * @param  {Object} segment
   * @return {Promise}
   */
  getOrCreateAudienceForSegment(segment) {
    const synchronizedSegmentIds = _.get(this.ship.private_settings, "synchronized_segments", []);
    if (!_.includes(synchronizedSegmentIds, segment.id)) {
      return Promise.resolve(null);
    }
    return this.fetchAudiences().then(audiences => {
      return audiences[segment.id] || this.createAudience(segment);
    });
  }

  handleSegmentUpdate(segment) {
    return this.getOrCreateAudienceForSegment(segment);
  }

  handleSegmentDelete(segment) {
    return this.fetchAudiences().then(audiences => {
      const audience = audiences[segment.id];
      return audience && this.fb(audience.id, {}, "del");
    });
  }

  removeUsersFromAudience(audienceId, users = []) {
    this.client.logger.info("removeUsersFromAudience", { audienceId, users: users.map(u => u.email) });
    return this.updateAudienceUsers(audienceId, users, "del");
  }

  addUsersToAudience(audienceId, users = []) {
    this.client.logger.info("addUsersToAudience", { audienceId, users: users.map(u => u.email) });
    return this.updateAudienceUsers(audienceId, users, "post");
  }

  updateAudienceUsers(audienceId, users, method) {
    const payload = this.customAudiences.buildCustomAudiencePayload(_.compact((users || [])));
    if (_.isEmpty(payload.data)) {
      return Promise.resolve({ data: [] });
    }

    const params = { payload };
    const action = method === "del" ? "remove" : "add";
    this.metric.increment("ship.outgoing.users", payload.data.length);
    this.metric.increment(`ship.outgoing.users.${action}`, payload.data.length);
    this.client.logger.debug("updateAudienceUsers", { audienceId, payload, method });
    return this.fb(`${audienceId}/users`, params, method)
      .then(() => {
        _.map(users, (u) => {
          this.client.logger.info("outgoing.user.success", _.pick(u, "id", "external_id", "email"));
        });
      }, () => {
        _.map(users, (u) => {
          this.client.logger.info("outgoing.user.error", _.pick(u, "id", "external_id", "email"));
        });
      });
  }

  fb(path, params = {}, method = "get") {
    this.metric.increment("ship.service_api.call", 1);
    fbgraph.setVersion("2.9");
    const { accessToken, accountId } = this.getCredentials();
    if (!accessToken) {
      throw new Error("MissingCredentials");
    }
    return new Promise((resolve, reject) => {
      let fullpath = path;

      if (path.match(/^customaudiences/)) {
        if (!accountId) {
          throw new Error("MissingAccountId");
        }
        fullpath = `act_${accountId}/${path}`;
      }

      const fullparams = Object.assign({}, params, { access_token: accessToken });
      fbgraph[method](fullpath, fullparams, (err, result) => {
        let error;
        if (err) {
          this.metric.increment("ship.errors", 1);
          this.client.logger.error("unauthorized", { method, fullpath, fullparams, err });
          error = {
            ...err,
            fullpath, fullparams, accountId
          };
        }
        return err ? reject(error) : resolve(result);
      });
    });
  }

  fetchPixels(accountId) {
    return this.fb(`act_${accountId}/adspixels`, { fields: "name" });
  }

  fetchImages(accountId) {
    return this.fb(`act_${accountId}/adimages`, { fields: "url_128" });
  }

  fetchAvailableAccounts(params = {}) {
    const fields = ACCOUNT_FIELDS.join(",");
    return this.fb("me/adaccounts", { ...params, fields })
    .then((({ data }) => {
      const promises = [];
      data.map((account) => {
        account.capabilities = _.compact((account.capabilities || []).map(
          cap => (CAPABILITIES[cap] || false)
        )).join(", ");

        const pix = this.fetchPixels(account.account_id).then((pixels) => {
          account.pixels = _.compact((pixels.data || []).map(px => px.name)).join(", ");
          return account;
        });
        promises.push(pix);

        const img = this.fetchImages(account.account_id).then(images => {
          account.images = _.slice((images.data || []).map(i => i.url_128), 0, 4);
          return account;
        });
        promises.push(img);

        return account;
      });

      return Promise.all(promises).then(() => data);
    }));
  }

  fetchAudiences() {
    // TODO Add support for paging
    return this.fb("customaudiences", {
      fields: AUDIENCE_FIELDS.join(","),
      limit: 100
    }).then(({ data }) => {
      return data.reduce((audiences, a) => {
        const match = a.description && a.description.match(/[a-z0-9]{24}/i);
        const segmentId = match && match[0];
        if (segmentId) {
          audiences[segmentId] = a;
        }
        return audiences;
      }, {});
    });
  }

}
