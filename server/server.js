import raven from "raven";

import { notifHandler, batchHandler } from "hull/lib/utils";

import FacebookAudience from "./facebook-audience";
import adminHandler from "./handlers/admin";

module.exports = function Server(options: any) {
  const { connector, app, facebookAppId, facebookAppSecret, sentryDSN } = options;

  if (sentryDSN) {
    app.use(raven.middleware.express.requestHandler(sentryDSN));
  }

  app.use("/notify", notifHandler({
    userHandlerOptions: {
      groupTraits: false
    },
    handlers: {
      "segment:update": FacebookAudience.handle("handleSegmentUpdate"),
      "segment:delete": FacebookAudience.handle("handleSegmentDelete"),
      "user:update": FacebookAudience.handleUserUpdate
    }
  }));

  /**
   * Handles batches. Only those which are sent with additional audience param - so ones requested from the ship.
   */
  app.use("/batch", batchHandler(({ client, ship, helpers, segments, metric }, messages = [], { query }) => {
    const { audience } = query;
    const users = messages.map(m => m.user);
    const fb = new FacebookAudience(ship, client, helpers, segments, metric);
    if (audience && users) {
      fb.addUsersToAudience(audience, users);
    }
  }, {
    groupTraits: false
  }));

  app.use("/admin", adminHandler({ connector, facebookAppSecret, facebookAppId }));

  return app;
};
