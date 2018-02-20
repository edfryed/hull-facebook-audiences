const _ = require("lodash");

const FacebookAudience = require("../lib/facebook-audience").default;

function segmentDeleteSmartNotifier({ client, ship, helpers, segments, metric }, messages) {
  const handler = new FacebookAudience(ship, client, helpers, segments, metric);
  if (!handler.isConfigured()) {
    const error = new Error("Missing credentials");
    error.status = 403;
    return Promise.reject(error);
  }
  return handler.handleSegmentDelete(_.get(messages, 0));
}

module.exports = segmentDeleteSmartNotifier;
