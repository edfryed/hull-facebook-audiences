import Hull from "hull";
import express from "express";

import Server from "./server";
import BatchSyncHandler from "./batch-sync-handler";

if (process.env.NEW_RELIC_LICENSE_KEY) {
  require("newrelic"); // eslint-disable-line global-require
}

if (process.env.LOG_LEVEL) {
  Hull.logger.transports.console.level = process.env.LOG_LEVEL;
}

function exitNow() {
  console.warn("Exiting now !");
  process.exit(0);
}

function handleExit() {
  console.log("Exiting... waiting 30 seconds workers to flush");
  setTimeout(exitNow, 30000);
  BatchSyncHandler.default.exit().then(exitNow);
}

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);

const port = process.env.PORT || 8082;
const hostSecret = process.env.SECRET;

const connector = new Hull.Connector({ port, hostSecret });

const app = express();
connector.setupApp(app);

Server({
  connector,
  app,
  hostSecret,
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
  sentryDSN: process.env.SENTRY_DSN
});

connector.startApp(app);
