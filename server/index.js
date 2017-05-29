/* @flow */
import Hull from "hull";
import express from "express";

import server from "./server";

if (process.env.LOG_LEVEL) {
  Hull.logger.transports.console.level = process.env.LOG_LEVEL;
}

const port = process.env.PORT || 8082;
const hostSecret = process.env.SECRET;

const connector = new Hull.Connector({ port, hostSecret });

const app = express();
connector.setupApp(app);

server(app, {
  connector,
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
});

connector.startApp(app);
