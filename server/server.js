// @flow
import express from "express";
import Promise from "bluebird";

import { notifHandler } from "hull/lib/utils";

import FacebookAudience from "./lib/facebook-audience";
import adminHandler from "./handlers/admin";

export default function server(app: express, dependencies: Object): express {
  const { facebookAppId, facebookAppSecret } = dependencies;

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
  app.use("/batch", notifHandler({
    handlers: {
      "user:update": ({ client, ship, helpers, segments, metric, options }, messages = []) => {
        const { audience } = options;
        const users = messages.map(m => m.user);
        const fb = new FacebookAudience(ship, client, helpers, segments, metric);
        if (audience && users) {
          return fb.addUsersToAudience(audience, users);
        }
        return Promise.resolve();
      }
    }
  }));
  app.use("/admin", adminHandler({ facebookAppSecret, facebookAppId }));

  return app;
}
