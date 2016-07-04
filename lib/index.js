"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _hull = require("hull");

var _hull2 = _interopRequireDefault(_hull);

var _server = require("./server");

var _server2 = _interopRequireDefault(_server);

var _libratoNode = require("librato-node");

var _libratoNode2 = _interopRequireDefault(_libratoNode);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_hull2.default.onLog(function onLog(message, data) {
  var ctx = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  console.log("[ " + ctx.id + " ] segment." + message, JSON.stringify(data || ""));
});

_hull2.default.onMetric(function onMetric(metric, value) {
  var ctx = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  console.log("[ " + ctx.id + " ] segment." + metric, value);
});

if (process.env.LIBRATO_TOKEN && process.env.LIBRATO_USER) {
  _libratoNode2.default.configure({
    email: process.env.LIBRATO_USER,
    token: process.env.LIBRATO_TOKEN
  });
  _libratoNode2.default.on("error", function onError(err) {
    console.error(err);
  });

  process.once("SIGINT", function onSigint() {
    _libratoNode2.default.stop(); // stop optionally takes a callback
  });
  _libratoNode2.default.start();

  _hull2.default.onLog(function onLog(message) {
    var data = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    var ctx = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    try {
      var payload = (typeof data === "undefined" ? "undefined" : _typeof(data)) === "object" ? JSON.stringify(data) : data;
      console.log("[" + ctx.id + "] " + message, payload);
    } catch (err) {
      console.log(err);
    }
  });

  _hull2.default.onMetric(function onMetricProduction() {
    var metric = arguments.length <= 0 || arguments[0] === undefined ? "" : arguments[0];
    var value = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];
    var ctx = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    try {
      if (_libratoNode2.default) {
        _libratoNode2.default.measure("facebook-audiences." + metric, value, Object.assign({}, { source: ctx.id }));
      }
    } catch (err) {
      console.warn("error in librato.measure", err);
    }
  });
}

(0, _server2.default)({
  Hull: _hull2.default,
  facebookAppId: process.env.FACEBOOK_APP_ID,
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET,
  port: process.env.PORT || 8082
});