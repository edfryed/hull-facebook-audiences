const _ = require("lodash");

const FacebookAudience = require("../lib/facebook-audience");

function userUpdateSmartNotifier({ client, ship, helpers, segments, metric }, messages) {
  const agent = new FacebookAudience(ship, client, helpers, segments, metric);
  const filteredMessages = messages.reduce((acc, message) => {
    const { user, changes } = message;
    const asUser = client.asUser(_.pick(user, "id", "external_id", "email"));

    // Ignore if no changes on users' segments
    if (!changes || _.isEmpty(changes.segments)) {
      asUser.logger.info("outgoing.user.skip", {
        reason: "no changes on users segments"
      });
      return acc;
    }

    // Reduce payload to keep in memory
    const payload = {
      user: _.pick(user, agent.customAudiences.getExtractFields()),
      changes: _.pick(changes, "segments")
    };

    if (!agent.isConfigured()) {
      asUser.logger.info("outgoing.user.skip", {
        reason: "connector is not configured" }
      );
      return acc;
    }

    return acc.concat(payload);
  }, []);

  FacebookAudience.flushUserUpdates.call(this, agent, filteredMessages);
}

module.exports = userUpdateSmartNotifier;
