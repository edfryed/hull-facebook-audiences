// @flow
import type { HullReqContext, HullUserUpdateMessage } from "hull";

const _ = require("lodash");

const FacebookAudience = require("../lib/facebook-audience").default;

function userUpdateSmartNotifier(ctx: HullReqContext, messages: Array<HullUserUpdateMessage>): Promise<*> {
  const { client, ship, helpers, segments, metric, smartNotifierResponse } = ctx;
  if (smartNotifierResponse) {
    smartNotifierResponse.setFlowControl({
      type: "next",
      size: 100,
      in: 10
    });
  }
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
      user: _.pick(user, agent.customAudiences.getExtractFields(), "id", "external_id", "email"),
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

  return FacebookAudience.flushUserUpdates(agent, filteredMessages);
}

module.exports = userUpdateSmartNotifier;
