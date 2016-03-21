import express from 'express';
import path from 'path';
import { NotifHandler } from 'hull';
import devMode from './dev-mode';
import _ from 'lodash';
import fetchShip from './middlewares/fetch-ship';
import streamExtract from './middlewares/stream-extract';
import bodyParser from 'body-parser';
import Promise from 'bluebird';

import FacebookAudience from './facebook-audience';

const notifHandler = NotifHandler({
  onSubscribe: FacebookAudience.handle('syncAllAudiences'),
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

  app.get('/admin.html', bodyParser.json(), fetchShip, (req, res) => {
    const { ship, client } = req.hull || {};
    const fb = new FacebookAudience(ship, client, req);
    fb.fetchAudiences();
    res.render('admin.html', { fb });
  });

  app.listen(port)

  return app;

}
