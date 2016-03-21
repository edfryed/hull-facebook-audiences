import Promise from 'bluebird';
import _ from 'lodash';
import URI from 'urijs';
import CSVStream from 'csv-stream';
import JSONStream from 'JSONStream';
import EventStream from 'event-stream';
import crypto from 'crypto';
import request from 'request';
const fbgraph = require('fbgraph');

const BASE_URL = process.env.BASE_URL || 'https://hull-computed-traits.ngrok.io';

const AUDIENCE_FIELDS = [
  'account_id',
  'approximate_count',
  'data_source',
  'delivery_status',
  'description',
  'excluded_custom_audiences',
  'external_event_source',
  'included_custom_audiences',
  'lookalike_spec',
  'name',
  'operation_status',
  'opt_out_link',
  'permission_for_actions',
  'pixel_id',
  'retention_days',
  'rule',
  'subtype',
  'time_content_updated',
  'time_created',
  'time_updated'
];

export default class FacebookAudience {

  static handle(method) {
    return ({ message }, { hull, ship, req }) => {
      const handler = new FacebookAudience(ship, hull, req);
      return handler[method](message);
    }
  }

  constructor(ship, hull, req) {
    this.ship = ship;
    this.hull = hull;
    this.req = req;
  }

  getAccessToken() {
    if (this.ship && this.ship.private_settings) {
      return this.ship.private_settings.facebook_access_token;
    }
  }

  getAccountId() {
    if (this.ship && this.ship.private_settings) {
      return this.ship.private_settings.facebook_ad_account_id;
    }
  }

  getCredentials() {
    return {
      accessToken: this.getAccessToken(),
      accountId: this.getAccountId()
    };
  }

  createAudience(segment, extract=true) {
    return this.fb('customaudiences', {
      subtype: 'CUSTOM',
      retention_days: 180,
      description: segment.id,
      name: `[Hull] ${segment.name}`
    }, 'post').then(audience => {
      if (extract) this.requestExtract({ segment, audience });
      return Object.assign({ isNew: true }, audience)
    });
  }

  getOrCreateAudienceForSegment(segment) {
    return this.fetchAudiences().then(audiences => {
      const audience = audiences[segment.id];
      if (!audience) {
        return this.createAudience(segment);
      } else {
        return audience;
      }
    });
  }

  handleUserUpdate({ user, segments, changes }) {
    if (changes && changes.segments) {
      const { entered, left } = changes.segments;
      (entered || []).map(this.handleUserEnteredSegment.bind(this, user));
      (left || []).map(this.handleUserLeftSegment.bind(this, user));
    }
  }

  handleUserEnteredSegment(user, segment) {
    return this.getOrCreateAudienceForSegment(segment).then(audience => {
      return this.addUsersToAudience(audience.id, [user]);
    });
  }

  handleUserLeftSegment(user, segment) {
    return this.getOrCreateAudienceForSegment(segment).then(audience => {
      return this.removeUsersFromAudience(audience.id, [user]);
    });
  }

  handleSegmentUpdate(segment) {
    return this.getOrCreateAudienceForSegment(segment);
  }

  handleSegmentDelete(segment) {
    return this.fetchAudiences().then(audiences => {
      const audience = audiences[segment.id];
      if (audience) {
        return this.fb(audience.id, {}, 'del');
      }
    });
  }

  requestExtract({ segment, audience, format }) {
    const { hostname, query } = this.req;
    const search = Object.assign({}, query, {
      segment: segment.id,
      audience: audience && audience.id
    });
    const callbackUrl = URI('https://' + hostname)
      .path('batch')
      .search(search).toString();

    return this.hull.get(segment.id).then(({ query }) => {
      return this.hull.post('extract/user_reports', {
        format: format || 'csv',
        fields: ['id', 'email', 'contact_email', 'name'],
        query: query,
        url: callbackUrl
      });
    });
  }

  removeUsersFromAudience(audienceId, users) {
    return this.updateAudienceUsers(audienceId, users, 'del');
  }

  addUsersToAudience(audienceId, users) {
    return this.updateAudienceUsers(audienceId, users, 'post');
  }

  updateAudienceUsers(audienceId, users, method) {
    const data = _.compact((users || []).map((user) => {
      const email = user.contact_email || user.email;
      if (email) {
        return crypto.createHash('sha256')
                      .update(email)
                      .digest('hex');
      }
    }));
    if (data && data.length > 0) {
      const schema = 'EMAIL_SHA256';
      const params = { payload: { schema, data } };
      return this.fb(audienceId + '/users', params, method);
    }
  }

  handleExtract({ url, format }, callback) {
    if (url && format) {
      const users = [];
      const decoder = format == 'csv' ? CSVStream.createStream() : JSONStream.parse();

      const flush = (user) => {
        if (user) {
          users.push(user);
        }
        if (users.length >= 100 || !user) {
          callback(users.splice(0))
        }
      }

      return request({ url })
        .pipe(decoder)
        .on('data', flush)
        .on('end', flush);
    }
  }

  deleteAudience(segment) {
  }

  fb(path, params={}, method='get') {
    fbgraph.setVersion('2.5');
    const { accessToken, accountId } = this.getCredentials();
    if (accountId && accessToken) {
      return new Promise((resolve, reject) => {
        let fullpath = path;

        if (path.match(/^customaudiences/)) {
          fullpath = `act_${accountId}/${path}`
        }

        const fullparams = Object.assign({}, params, { access_token: accessToken });
        fbgraph[method](fullpath, fullparams, (err, result) => {
          err ? reject(err) : resolve(result);
        })
      });
    } else {
      return Promise.reject(new Error('Missing Credentials'));
    }
  }

  fetchAudiences() {
    // TODO Add support for paging
    return this.fb( 'customaudiences',
      { fields: AUDIENCE_FIELDS.join(','), limit: 100 }
    ).then(({ data }) => {
      return data.reduce((audiences, a) => {
        const match = a.description && a.description.match(/[a-z0-9]{24}/i);
        const segmentId = match && match[0];
        if (segmentId) {
          audiences[segmentId] = a;
        }
        return audiences;
      }, {})
    });
  }

  syncAudiences({ message }, { hull, ship }) {
    this.hull.get('segments', { limit: 500 }).then(segments => {
      segments.map(segment => {
        this.updateAudience({ message: { segment } }, { hull, ship })
      })
    });
  }
}
