const Connector = require("hull").Connector;
const express = require("express");

const server = require("../../../server/server").default;

module.exports = function bootstrap() {
  const app = express();
  const connector = new Connector({ hostSecret: "1234", port: 8000, clientConfig: { protocol: "http", firehoseUrl: "firehose" } });
  connector.setupApp(app);
  server(app, {
    hostSecret: "1234",
    facebookAppId: "facebookAppId",
    facebookAppSecret: "facebookAppSecret"
  });

  connector.startWorker();
  return connector.startApp(app);
};
