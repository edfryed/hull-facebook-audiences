import express from 'express';
import path from 'path';
import { NotifHandler } from 'hull';
import devMode from './dev-mode';
import _ from 'lodash';
import fetchShip from './middlewares/fetch-ship';
import bodyParser from 'body-parser';
import Promise from 'bluebird';
import fbgraph from 'fbgraph';

import FacebookAudience from './facebook-audience';

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '1104279809616629';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

const notifHandler = NotifHandler({
  onSubscribe: FacebookAudience.sync,
  events: {
    'users_segment:update': FacebookAudience.handle('handleSegmentUpdate'),
    'users_segment:delete': FacebookAudience.handle('handleSegmentDelete'),
    'user_report:update': FacebookAudience.handle('handleUserUpdate')
  }
});



module.exports = function(port) {

  const app = express();

  app.engine('html', require('ejs').renderFile);

  app.set('views', __dirname + '/views');

  if (process.env.NODE_ENV !== 'production') {
    app.use(devMode());
  }

  app.use(express.static(path.resolve(__dirname, '..', 'dist')));
  app.use(express.static(path.resolve(__dirname, '..', 'assets')));

  app.get('/manifest.json', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'manifest.json'));
  });

  app.get('/readme', (req,res) => {
    res.redirect(`https://dashboard.hullapp.io/readme?url=https://${req.headers.host}`);
  });

  app.post('/notify', notifHandler);

  app.post('/batch', bodyParser.json(), fetchShip, (req, res) => {
    const { ship, client } = req.hull || {};
    const { audience } = req.query;
    const fb = new FacebookAudience(ship, client, req);
    if (ship && audience) {
      fb.handleExtract(req.body, users => {
        fb.addUsersToAudience(audience, users);
      });
    }
    res.end('thanks !');
  });

  app.post('/admin.html', bodyParser.urlencoded({ extended: true }), fetchShip, (req, res) => {
    const { facebook_access_token, facebook_ad_account_id, extendAccessToken } = req.body;
    const { client, ship } = req.hull;

    const getAccessToken = new Promise((resolve, reject) => {
      if (extendAccessToken && facebook_access_token) {
        fbgraph.extendAccessToken({
          access_token: facebook_access_token,
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET
        }, (err, res) => {
           err ? reject(err) : resolve(res.access_token);
        });
      } else {
        resolve(facebook_access_token);
      }
    });

    getAccessToken.then((facebook_access_token) => {
      const private_settings = Object.assign({}, ship.private_settings || {}, { facebook_access_token, facebook_ad_account_id });
      client.put(ship.id, { private_settings }).then(ship => {
        res.redirect(req.url);
      }, (err) => {
        res.render('error.html', { err: err });
      });
    }, (err) => {
      res.render('error.html', { err: err });
    })
  });

  app.get('/admin.html', bodyParser.json(), fetchShip, (req, res) => {
    const { ship, client } = req.hull || {};
    const fb = new FacebookAudience(ship, client, req);
    const { accessToken, accountId } = fb.getCredentials();
    if (!accessToken) {
      res.render('login.html', { facebookAppId: FACEBOOK_APP_ID });
    } else if (!accountId) {
      fb.fetchAvailableAccounts().then(({ data }) => {
        res.render('accounts.html', Object.assign({ url: req.url }, req.query, { accounts: data, fb }));
      }, (err) => {
        res.render('error.html', { err: err, fb });
      })
    } else {
      fb.fetchAudiences().then((audiences) => {
        res.render('audiences.html', { audiences: _.values(audiences), fb })
      }, (err) => {
        res.render('error.html', { err: err, fb });
      })
    }
  });

  app.listen(port)

  return app;

}
