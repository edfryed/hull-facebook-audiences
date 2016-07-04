'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Server;

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _fetchShip = require('./middlewares/fetch-ship');

var _fetchShip2 = _interopRequireDefault(_fetchShip);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _fbgraph = require('fbgraph');

var _fbgraph2 = _interopRequireDefault(_fbgraph);

var _capabilities = require('./capabilities');

var _capabilities2 = _interopRequireDefault(_capabilities);

var _facebookAudience = require('./facebook-audience');

var _facebookAudience2 = _interopRequireDefault(_facebookAudience);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function Server(_ref) {
  var Hull = _ref.Hull;
  var port = _ref.port;
  var facebookAppId = _ref.facebookAppId;
  var facebookAppSecret = _ref.facebookAppSecret;
  var BatchHandler = Hull.BatchHandler;
  var NotifHandler = Hull.NotifHandler;
  var Routes = Hull.Routes;
  var Middlewares = Hull.Middlewares;


  var app = (0, _express2.default)();

  app.engine('html', require('ejs').renderFile);
  app.set('views', __dirname + '/views');

  app.use(_express2.default.static(_path2.default.resolve(__dirname, '..', 'dist')));
  app.use(_express2.default.static(_path2.default.resolve(__dirname, "..", "assets")));

  app.get("/manifest.json", Routes.Manifest(__dirname));
  app.get("/", Routes.Readme);
  app.get("/readme", Routes.Readme);

  app.post('/notify', NotifHandler({
    onSubscribe: function onSubscribe() {
      console.warn("Hello new subscriber");
    },

    groupTraits: false,
    handlers: {
      'segment:update': _facebookAudience2.default.handle('handleSegmentUpdate'),
      'segment:delete': _facebookAudience2.default.handle('handleSegmentDelete'),
      'report:update': _facebookAudience2.default.handle('handleUserUpdate')
    }
  }));

  app.post("/batch", BatchHandler({
    groupTraits: false,
    handler: function handler(req, res) {
      var _ref2 = req.hull || {};

      var ship = _ref2.ship;
      var client = _ref2.client;
      var audience = req.query.audience;

      var fb = new _facebookAudience2.default(ship, client, req);
      if (ship && audience) {
        fb.handleExtract(req.body, function (users) {
          fb.addUsersToAudience(audience, users);
        });
      }
      res.end('thanks !');
    }
  }));

  app.post('/admin.html', _bodyParser2.default.urlencoded({ extended: true }), _fetchShip2.default, function (req, res) {
    var _req$body = req.body;
    var facebook_access_token = _req$body.facebook_access_token;
    var facebook_ad_account_id = _req$body.facebook_ad_account_id;
    var extendAccessToken = _req$body.extendAccessToken;
    var _req$hull = req.hull;
    var client = _req$hull.client;
    var ship = _req$hull.ship;


    var getAccessToken = new _bluebird2.default(function (resolve, reject) {
      if (extendAccessToken && facebook_access_token) {
        _fbgraph2.default.extendAccessToken({
          access_token: facebook_access_token,
          client_id: facebookAppId,
          client_secret: facebookAppSecret
        }, function (err, res) {
          err ? reject(err) : resolve(res.access_token);
        });
      } else {
        resolve(facebook_access_token);
      }
    });

    getAccessToken.then(function (facebook_access_token) {
      var private_settings = Object.assign({}, ship.private_settings || {}, { facebook_access_token: facebook_access_token, facebook_ad_account_id: facebook_ad_account_id });
      client.put(ship.id, { private_settings: private_settings }).then(function (ship) {
        try {
          if (facebook_access_token && facebook_ad_account_id) {
            var fb = new _facebookAudience2.default(ship, client, req);
            fb.sync().then(function (done) {
              return res.redirect(req.url);
            }, function (err) {
              return res.render('error.html', { err: err });
            });
          } else {
            res.redirect(req.url);
          }
        } catch (err) {
          res.render('error.html', { err: err });
        }
      }, function (err) {
        res.render('error.html', { err: err });
      });
    }, function (err) {
      res.render('error.html', { err: err });
    });
  });

  app.get('/admin.html', _bodyParser2.default.json(), _fetchShip2.default, function (req, res) {
    var _ref3 = req.hull || {};

    var ship = _ref3.ship;
    var client = _ref3.client;

    var fb = new _facebookAudience2.default(ship, client, req);

    var _fb$getCredentials = fb.getCredentials();

    var accessToken = _fb$getCredentials.accessToken;
    var accountId = _fb$getCredentials.accountId;

    if (!accessToken) {
      res.render('login.html', { facebookAppId: FACEBOOK_APP_ID });
    } else if (!accountId) {
      var renderError = function renderError(err) {
        res.render('error.html', { err: err, fb: fb });
      };
      fb.fetchAvailableAccounts().then(function (_ref4) {
        var data = _ref4.data;

        var promises = [];
        data.map(function (account) {
          account.capabilities = _lodash2.default.compact((account.capabilities || []).map(function (cap) {
            return _capabilities2.default[cap] || false;
          })).join(', ');
          var pix = fb.fetchPixels(account.account_id).then(function (pixels) {
            account.pixels = _lodash2.default.compact((pixels.data || []).map(function (px) {
              return px.name;
            })).join(', ');
            return account;
          });
          promises.push(pix);
          var img = fb.fetchImages(account.account_id).then(function (images) {
            account.images = _lodash2.default.slice((images.data || []).map(function (img) {
              return img.url_128;
            }), 0, 4);
            return account;
          });
          promises.push(img);
        });
        return _bluebird2.default.all(promises).then(function (values) {
          return data;
        });
      }, renderError).then(function (data) {
        res.render('accounts.html', Object.assign({ url: req.url }, req.query, { accounts: data || [], fb: fb }));
      }, renderError);
    } else {
      fb.fetchAudiences().then(function (audiences) {
        res.render('audiences.html', { audiences: _lodash2.default.values(audiences) || [], fb: fb });
      }, function (err) {
        res.render('error.html', { err: err, fb: fb });
      });
    }
  });

  app.listen(port);

  return app;
}