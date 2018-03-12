const FacebookAudience = require("../lib/facebook-audience");

function statusHandler(req, res) {
  const { ship, client, helpers, segments, metric } = req.hull;
  const messages = [];
  let status = "ok";

  const handler = new FacebookAudience(ship, client, helpers, segments, metric);
  if (!handler.isConfigured()) {
    status = "error";
    messages.push("Connector is not authorized with Facebook API");
  }

  res.json({ messages, status });
  client.put(`${req.hull.ship.id}/status`, { status, messages });
}

module.exports = statusHandler;
