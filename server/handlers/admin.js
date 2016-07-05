import { Router } from "express";
import fbgraph from "fbgraph";
import bodyParser from "body-parser";
import FacebookAudience from "../facebook-audience";
import _ from "lodash";

export default function adminHander({ Hull, facebookAppSecret, facebookAppId }) {
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

  function updateSettings({ hull, ship, params, req }) {
    const { facebook_ad_account_id } = params;
    return getAccessToken(params)
      .then(facebook_access_token => {
        return hull.put(ship.id, {
          private_settings: {
            ...ship.private_settings,
            facebook_access_token,
            facebook_ad_account_id
          }
        });
      })
      .then(updatedShip => {
        const fb = new FacebookAudience(updatedShip, hull, req);
        return fb.isConfigured()
          && fb.sync(ship, hull, req);
      });
  }

  function handleError(context, err = {}) {
    if (err.type === "OAuthException" && (err.code === 100 || err.code === 190)) {
      this.render("login.html", context);
    } else {
      err.title = `Error #${err.code} - ${err.type}`;
      if (err.code === 2655 || err.code === 2664) {
        err.title = "Terms of service has not been accepted.";
        err.action = {
          message: "Click here to accept them",
          url: `https://www.facebook.com/ads/manage/customaudiences/tos.php?act=${_.get(context, "ship.private_settings.facebook_ad_account_id")}`
        };
      }

      this.render("error.html", { ...context, err });
    }
  }

  const app = Router();

  app.use(Hull.Middlewares.hullClient({ cacheShip: false }));

  app.post("/", bodyParser.urlencoded({ extended: true }), (req, res) => {
    const params = req.body;
    const { client: hull, ship } = req.hull;
    const context = { query: req.query, search: req.search, facebookAppId, ship };
    return updateSettings({ hull, ship, params, req })
      .then(
        () => {
          res.redirect("back");
        }
      )
      .catch(handleError.bind(res, context));
  });

  app.post("/sync", bodyParser.urlencoded({ extended: true }), (req, res) => {
    const { client: hull, ship } = req.hull;
    const context = { query: req.query, facebookAppId, ship };
    const fb = new FacebookAudience(ship, hull, req);
    if (fb.isConfigured()) {
      return fb.sync(ship, hull, req).then(
        () => res.redirect("back")
      ).catch(handleError.bind(res, context));
    }

    return res.redirect("back");
  });

  app.get("/", (req, res) => {
    const { ship, client: hull } = req.hull || {};
    const fb = new FacebookAudience(ship, hull, req);

    const { accessToken, accountId } = fb.getCredentials();
    const context = { fb, url: req.url, query: req.query, facebookAppId };


    if (!accessToken) {
      res.render("login.html", context);
    } else if (!accountId) {
      fb.fetchAvailableAccounts()
       .then(accounts => res.render("accounts.html", { ...context, accounts }))
       .catch(handleError.bind(res, context));
    } else {
      fb.fetchAudiences()
        .then(audiences => res.render("audiences.html", { ...context, audiences: _.values(audiences) }))
        .catch(handleError.bind(res, context));
    }
  });


  return app;
}
