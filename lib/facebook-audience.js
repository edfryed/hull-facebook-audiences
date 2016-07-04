'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _urijs = require('urijs');

var _urijs2 = _interopRequireDefault(_urijs);

var _csvStream = require('csv-stream');

var _csvStream2 = _interopRequireDefault(_csvStream);

var _JSONStream = require('JSONStream');

var _JSONStream2 = _interopRequireDefault(_JSONStream);

var _eventStream = require('event-stream');

var _eventStream2 = _interopRequireDefault(_eventStream);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fbgraph = require('fbgraph');

var BASE_URL = process.env.BASE_URL || 'https://hull-facebook-audiences.herokuapp.com';

var AUDIENCE_FIELDS = ['account_id', 'approximate_count', 'data_source', 'delivery_status', 'description', 'excluded_custom_audiences', 'external_event_source', 'included_custom_audiences', 'lookalike_spec', 'name', 'operation_status', 'opt_out_link', 'permission_for_actions', 'pixel_id', 'retention_days', 'rule', 'subtype', 'time_content_updated', 'time_created', 'time_updated'];

var FacebookAudience = function () {
  _createClass(FacebookAudience, [{
    key: 'sync',
    value: function sync() {
      var _this = this;

      return _bluebird2.default.all([this.fetchAudiences(), this.hull.get('segments', { limit: 500 })]).then(function (ab) {
        var audiences = ab[0];
        var segments = ab[1];
        return _bluebird2.default.all(segments.map(function (segment) {
          return audiences[segment.id] || _this.createAudience(segment);
        }));
      });
    }
  }], [{
    key: 'handle',
    value: function handle(method) {
      return function (_ref, _ref2) {
        var message = _ref.message;
        var hull = _ref2.hull;
        var ship = _ref2.ship;
        var req = _ref2.req;

        var handler = new FacebookAudience(ship, hull, req);
        if (!handler.isConfigured()) {
          var error = new Error("Missing credentials");
          error.status = 403;
          return _bluebird2.default.reject(error);
        }
        return handler[method](message);
      };
    }
  }]);

  function FacebookAudience(ship, hull, req) {
    _classCallCheck(this, FacebookAudience);

    this.ship = ship;
    this.hull = hull;
    this.req = req;
  }

  _createClass(FacebookAudience, [{
    key: 'getAccessToken',
    value: function getAccessToken() {
      if (this.ship && this.ship.private_settings) {
        return this.ship.private_settings.facebook_access_token;
      }
    }
  }, {
    key: 'getAccountId',
    value: function getAccountId() {
      if (this.ship && this.ship.private_settings) {
        return this.ship.private_settings.facebook_ad_account_id;
      }
    }
  }, {
    key: 'getManagerUrl',
    value: function getManagerUrl(audience) {
      return 'https://www.facebook.com/ads/manager/audiences/detail/?act=' + this.getAccountId() + '&pid=p3&ids=' + audience.id;
    }
  }, {
    key: 'getCredentials',
    value: function getCredentials() {
      return {
        accessToken: this.getAccessToken(),
        accountId: this.getAccountId()
      };
    }
  }, {
    key: 'isConfigured',
    value: function isConfigured() {
      var _getCredentials = this.getCredentials();

      var accessToken = _getCredentials.accessToken;
      var accountId = _getCredentials.accountId;

      return !!(accessToken && accountId);
    }
  }, {
    key: 'createAudience',
    value: function createAudience(segment) {
      var _this2 = this;

      var extract = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];

      return this.fb('customaudiences', {
        subtype: 'CUSTOM',
        retention_days: 180,
        description: segment.id,
        name: '[Hull] ' + segment.name
      }, 'post').then(function (audience) {
        if (extract) _this2.requestExtract({ segment: segment, audience: audience });
        return Object.assign({ isNew: true }, audience);
      });
    }
  }, {
    key: 'getOrCreateAudienceForSegment',
    value: function getOrCreateAudienceForSegment(segment) {
      var _this3 = this;

      return this.fetchAudiences().then(function (audiences) {
        var audience = audiences[segment.id];
        if (!audience) {
          return _this3.createAudience(segment);
        } else {
          return audience;
        }
      });
    }
  }, {
    key: 'handleUserUpdate',
    value: function handleUserUpdate(_ref3) {
      var user = _ref3.user;
      var segments = _ref3.segments;
      var changes = _ref3.changes;

      if (changes && changes.segments) {
        var _changes$segments = changes.segments;
        var entered = _changes$segments.entered;
        var left = _changes$segments.left;

        (entered || []).map(this.handleUserEnteredSegment.bind(this, user));
        (left || []).map(this.handleUserLeftSegment.bind(this, user));
      }
    }
  }, {
    key: 'handleUserEnteredSegment',
    value: function handleUserEnteredSegment(user, segment) {
      var _this4 = this;

      return this.getOrCreateAudienceForSegment(segment).then(function (audience) {
        return _this4.addUsersToAudience(audience.id, [user]);
      });
    }
  }, {
    key: 'handleUserLeftSegment',
    value: function handleUserLeftSegment(user, segment) {
      var _this5 = this;

      return this.getOrCreateAudienceForSegment(segment).then(function (audience) {
        return _this5.removeUsersFromAudience(audience.id, [user]);
      });
    }
  }, {
    key: 'handleSegmentUpdate',
    value: function handleSegmentUpdate(segment) {
      return this.getOrCreateAudienceForSegment(segment);
    }
  }, {
    key: 'handleSegmentDelete',
    value: function handleSegmentDelete(segment) {
      var _this6 = this;

      return this.fetchAudiences().then(function (audiences) {
        var audience = audiences[segment.id];
        if (audience) {
          return _this6.fb(audience.id, {}, 'del');
        }
      });
    }
  }, {
    key: 'requestExtract',
    value: function requestExtract(_ref4) {
      var _this7 = this;

      var segment = _ref4.segment;
      var audience = _ref4.audience;
      var format = _ref4.format;
      var _req = this.req;
      var hostname = _req.hostname;
      var query = _req.query;

      var search = Object.assign({}, query, {
        segment: segment.id,
        audience: audience && audience.id
      });
      var callbackUrl = (0, _urijs2.default)('https://' + hostname).path('batch').search(search).toString();

      return this.hull.get(segment.id).then(function (_ref5) {
        var query = _ref5.query;

        return _this7.hull.post('extract/user_reports', {
          format: format || 'csv',
          fields: ['id', 'email', 'contact_email', 'name'],
          query: query,
          url: callbackUrl
        });
      });
    }
  }, {
    key: 'removeUsersFromAudience',
    value: function removeUsersFromAudience(audienceId, users) {
      return this.updateAudienceUsers(audienceId, users, 'del');
    }
  }, {
    key: 'addUsersToAudience',
    value: function addUsersToAudience(audienceId, users) {
      return this.updateAudienceUsers(audienceId, users, 'post');
    }
  }, {
    key: 'updateAudienceUsers',
    value: function updateAudienceUsers(audienceId, users, method) {
      var data = _lodash2.default.compact((users || []).map(function (user) {
        var email = user.contact_email || user.email;
        if (email) {
          return _crypto2.default.createHash('sha256').update(email).digest('hex');
        }
      }));
      if (data && data.length > 0) {
        var schema = 'EMAIL_SHA256';
        var params = { payload: { schema: schema, data: data } };
        return this.fb(audienceId + '/users', params, method);
      }
    }
  }, {
    key: 'handleExtract',
    value: function handleExtract(_ref6, callback) {
      var url = _ref6.url;
      var format = _ref6.format;

      if (url && format) {
        var _ret = function () {
          var users = [];
          var decoder = format == 'csv' ? _csvStream2.default.createStream() : _JSONStream2.default.parse();

          var flush = function flush(user) {
            if (user) {
              users.push(user);
            }
            if (users.length >= 100 || !user) {
              callback(users.splice(0));
            }
          };

          return {
            v: (0, _request2.default)({ url: url }).pipe(decoder).on('data', flush).on('end', flush)
          };
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
      }
    }
  }, {
    key: 'fb',
    value: function fb(path) {
      var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
      var method = arguments.length <= 2 || arguments[2] === undefined ? 'get' : arguments[2];

      fbgraph.setVersion('2.5');

      var _getCredentials2 = this.getCredentials();

      var accessToken = _getCredentials2.accessToken;
      var accountId = _getCredentials2.accountId;

      if (accessToken) {
        return new _bluebird2.default(function (resolve, reject) {
          var fullpath = path;

          if (path.match(/^customaudiences/)) {
            if (!accountId) {
              return _bluebird2.default.reject(new Error('Missing AccountId'));
            }
            fullpath = 'act_' + accountId + '/' + path;
          }

          var fullparams = Object.assign({}, params, { access_token: accessToken });
          fbgraph[method](fullpath, fullparams, function (err, result) {
            if (err) {
              console.warn("Oops too bad cannot do that: ", JSON.stringify({ fullpath: fullpath, fullparams: fullparams }));
            }
            err ? reject(err) : resolve(result);
          });
        });
      } else {
        return _bluebird2.default.reject(new Error('Missing Credentials'));
      }
    }
  }, {
    key: 'fetchPixels',
    value: function fetchPixels(accountId) {
      return this.fb('act_' + accountId + '/adspixels', { fields: 'name' });
    }
  }, {
    key: 'fetchImages',
    value: function fetchImages(accountId) {
      return this.fb('act_' + accountId + '/adimages', { fields: 'url_128' });
    }
  }, {
    key: 'fetchAvailableAccounts',
    value: function fetchAvailableAccounts() {
      var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return this.fb('me/adaccounts', Object.assign({}, params, {
        fields: ['id', 'account_id', 'name', 'account_status', 'owner', 'owner_business', 'capabilities', 'business', 'user_role'].join(',')
      }));
    }
  }, {
    key: 'fetchAudiences',
    value: function fetchAudiences() {
      // TODO Add support for paging
      return this.fb('customaudiences', { fields: AUDIENCE_FIELDS.join(','), limit: 100 }).then(function (_ref7) {
        var data = _ref7.data;

        return data.reduce(function (audiences, a) {
          var match = a.description && a.description.match(/[a-z0-9]{24}/i);
          var segmentId = match && match[0];
          if (segmentId) {
            audiences[segmentId] = a;
          }
          return audiences;
        }, {});
      });
    }
  }]);

  return FacebookAudience;
}();

exports.default = FacebookAudience;