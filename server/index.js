if (process.env.NEW_RELIC_LICENSE_KEY) {
  require("newrelic"); // eslint-disable-line global-require
}

const Hull = require("hull");
const Server = require("./server");
const BatchSyncHandler = require("./batch-sync-handler").default;

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
  BatchSyncHandler.exit().then(exitNow);
}

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);

Server({
  Hull,
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
  port: process.env.PORT || 8082,
  sentryDSN: process.env.SENTRY_DSN
});
