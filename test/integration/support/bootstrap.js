const Connector = require("hull").Connector;
const express = require("express");

const server = require("../../server/server").default;

module.exports = function bootstrap(port) {
  const app = express();
  const connector = new Connector({ hostSecret: "1234", port, clientConfig: { protocol: "http", firehoseUrl: "firehose" } });
  connector.setupApp(app);
  server(app, {
    hostSecret: "1234",
    facebookAppId: "facebookAppId",
    facebookAppSecret: "facebookAppSecret"
  });
  worker(connector);

  connector.startWorker();
  return connector.startApp(app);
};
