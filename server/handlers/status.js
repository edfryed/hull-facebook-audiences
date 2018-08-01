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

  if (
    ship.private_settings.synchronized_segments
    && !ship.private_settings.synchronized_segments_mapping
  ) {
    status = "error";
    messages.push("Due to recent Facebook API changes, you need to migrate segments information adding `customer_file_source` information. Until you add them this connector won't be able to create new custom audiences.");
  }

  handler.fetchAudiences()
    .then(() => {
      // correct response
    })
    .catch((error) => {
      status = "error";
      messages.push(error.message);
    })
    .then(() => {
      res.json({ messages, status });
      client.put(`${req.hull.ship.id}/status`, { status, messages });
    });
}

module.exports = statusHandler;
