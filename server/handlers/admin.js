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
           err ? reject(err) : resolve(res.access_token);
        });
      } else {
        resolve(facebook_access_token);
      }
    })
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
        })
      })
      .then(ship => {
        console.warn("Staring audience sync...");
        const fb = new FacebookAudience(ship, hull, req);
        if (fb.isConfigured()) {
          return fb.sync(ship, hull, req);
        }
      });
  }

  function handleError(context, err) {
    console.warn("Here is my wonderful error !", {context, err})
    if (err.type === 'OAuthException') {
      this.render("login.html", context);
    } else {
      this.render("error.html", { ...context, err });
    }

  }

  const app = Router();

  app.use(Hull.Middlewares.hullClient({ cacheShip: false }));

  app.use((req, res, next) => {
    console.warn("\n\n\n\n\n\n==========================================")
    next();
  })

  app.post("/", bodyParser.urlencoded({ extended: true }), (req, res) => {
    console.warn("post /admin")
    const context = { query: req.query, facebookAppId };
    const params = req.body;
    const { client: hull, ship } = req.hull;
    console.warn("updateSettings...")
    return updateSettings({ hull, ship, params, req })
      .then(
        () => {
          res.redirect('back')
        }
      )
      .catch(handleError.bind(res, context))
  });

  app.get("/", (req, res) => {
    console.warn("get /admin")

    const { ship, client: hull } = req.hull || {};
    const fb = new FacebookAudience(ship, hull, req);

    const { accessToken, accountId } = fb.getCredentials();
    const context = { fb, query: req.query, facebookAppId };


    if (!accessToken) {
      console.warn("Please log in first...")
      res.render("login.html", context);
    } else if (!accountId) {

      console.warn("Fetching accounts !!!")

      fb.fetchAvailableAccounts()
       .then(accounts => res.render("accounts.html", { ...context, accounts }))
       .catch(handleError.bind(res, context))

    } else {


      console.warn("Fetching audiences: ", { accountId });


      fb.fetchAudiences()
        .then(audiences => res.render("audiences.html", { ...context, audiences: _.values(audiences) }))
        .catch(handleError.bind(res, context));
    }
  });


  return app;

}


