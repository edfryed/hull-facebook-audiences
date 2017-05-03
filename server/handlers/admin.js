/* @flow */
import { Router } from "express";
import fbgraph from "fbgraph";
import bodyParser from "body-parser";
import FacebookAudience from "../facebook-audience";
import Promise from "bluebird";
import _ from "lodash";

export default function adminHander({ facebookAppSecret, facebookAppId }: any) {
  function getAccessToken({ facebook_access_token, extendAccessToken }) {
    return new Promise((resolve, reject) => {
      if (extendAccessToken && facebook_access_token) {
        fbgraph.extendAccessToken({
          access_token: facebook_access_token,
          client_id: facebookAppId,
          client_secret: facebookAppSecret
        }, (err, res) => {
          return err ? reject(err) : resolve(res.access_token);
        });
      } else {
        resolve(facebook_access_token);
      }
    });
  }

  function updateSettings({ client, ship, helpers, segments, metric, params }) {
    const { facebook_ad_account_id } = params;
    return getAccessToken(params)
      .then(facebook_access_token => {
        return helpers.updateSettings({
          facebook_access_token,
          facebook_ad_account_id
        });
      })
      .then(updatedShip => {
        const fb = new FacebookAudience(updatedShip, client, helpers, segments, metric);
        return fb.isConfigured()
          && fb.sync();
      });
  }

  function handleError(context, err = {}) {
    console.error(err);
    if (err.type === "OAuthException" && (err.code === 100 || err.code === 190)) {
      this.render("login.html", context);
    } else {
      err.title = `Error #${err.code} - ${err.type}`;
      if (err.code === 2655 || err.code === 2664) {
        err.title = "Terms of service has not been accepted.";
        err.action = {
          message: "Click here to accept them",
          url: `https://www.facebook.com/ads/manage/customaudiences/tos.php?act=${err.accountId}`
        };
      }

      this.render("error.html", { ...context, err });
    }
  }

  const app = Router();

  app.use(bodyParser.urlencoded({ extended: true }));

  app.post("/", (req, res) => {
    const params = req.body;
    const { client, ship, helpers, segments, metric } = req.hull;
    const context = { query: req.query, search: req.search, facebookAppId, ship };
    return updateSettings({ client, ship, helpers, segments, metric, params })
      .then(
        () => {
          res.redirect("back");
        }
      )
      .catch(handleError.bind(res, context));
  });

  app.post("/sync", (req, res) => {
    const { client, ship, helpers, segments, metric } = req.hull;
    const context = { query: req.query, facebookAppId, ship };
    const fb = new FacebookAudience(ship, client, helpers, segments, metric);
    if (fb.isConfigured()) {
      return fb.sync().then(
        () => res.redirect("back")
      ).catch(handleError.bind(res, context));
    }

    return res.redirect("back");
  });

  app.get("/", (req, res) => {
    const { ship, client, helpers, segments, metric } = req.hull || {};
    const fb = new FacebookAudience(ship, client, helpers, segments, metric);

    const { accessToken, accountId } = fb.getCredentials();
    const context = { fb, url: req.url, query: req.query, facebookAppId };


    if (!accessToken) {
      res.render("login.html", context);
    } else if (!accountId) {
      fb.fetchAvailableAccounts()
       .then(accounts => res.render("accounts.html", { ...context, accounts }))
       .catch(handleError.bind(res, context));
    } else {
      Promise.all([
        fb.fetchAudiences(),
        fb.client.get("segments", { limit: 500 }),
        fb.getSynchronizedSegments()
      ])
      .spread((audiences, segmentsToSpread, synchronizedSegments) => {
        return res.render("audiences.html", {
          ...context,
          audiences,
          segments: segmentsToSpread,
          synchronizedSegments,
          _
        });
      })
      .catch(handleError.bind(res, context));
    }
  });


  return app;
}
