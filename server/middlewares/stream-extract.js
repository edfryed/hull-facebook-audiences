import request from 'request';
import csv from 'csv-stream';
import es from 'event-stream';
import Promise from 'bluebird';
import _ from 'lodash';

export default function(handler) {

  return (req, res, next) => {

    const { url } = req.body || {};
    const { client, ship } = req.hull;

    if (handler && url && client && ship) {
      let count = 0;

      const options = {};

      return request({ url })
        .pipe(csv.createStream(options))
        .pipe(es.mapSync(handler));

      next();
    } else {
      res.status(400);
      res.send({ reason: 'missing_params' });
      res.end();
    }
  }
}
