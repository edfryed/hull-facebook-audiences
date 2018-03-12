/* @flow */
const Hull = require("hull");
const { Cache } = require("hull/lib/infra");
const redisStore = require("cache-manager-redis-store");
const express = require("express");

const server = require("./server");

if (process.env.LOG_LEVEL) {
  Hull.logger.transports.console.level = process.env.LOG_LEVEL;
}

let cache;

if (process.env.CACHE_REDIS_URL) {
  cache = new Cache({
    store: redisStore,
    url: process.env.CACHE_REDIS_URL,
    ttl: process.env.SHIP_CACHE_TTL || 180
  });
}

const port = process.env.PORT || 8082;
const hostSecret = process.env.SECRET;

const connector = new Hull.Connector({
  port,
  hostSecret,
  cache,
  clientConfig: {
    firehoseUrl: process.env.OVERRIDE_FIREHOSE_URL
  }
});

const app = express();
connector.setupApp(app);

server(app, {
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
});

connector.startApp(app);
