import express from "express";
import path from "path";
import ejs from "ejs";

import FacebookAudience from "./facebook-audience";
import adminHandler from "./handlers/admin";


export default function Server({ Hull, port, facebookAppId, facebookAppSecret }) {
  const { BatchHandler, NotifHandler, Routes } = Hull;

  const app = express();
  app.engine("html", ejs.renderFile);
  app.set("views", `${__dirname}/views`);


  app.use(express.static(path.resolve(__dirname, "..", "dist")));
  app.use(express.static(path.resolve(__dirname, "..", "assets")));

  app.get("/manifest.json", Routes.Manifest(__dirname));
  app.get("/", Routes.Readme);
  app.get("/readme", Routes.Readme);

  app.post("/notify", NotifHandler({
    onSubscribe() {
      console.warn("Hello new subscriber");
    },
    groupTraits: false,
    handlers: {
      "segment:update": FacebookAudience.handle("handleSegmentUpdate"),
      "segment:delete": FacebookAudience.handle("handleSegmentDelete"),
      "user:update": FacebookAudience.handle("handleUserUpdate")
    }
  }));

  app.post("/batch", BatchHandler({
    groupTraits: false,
    handler(messages = [], { hull, ship, req }) {
      const { audience } = req.query;
      const fb = new FacebookAudience(ship, hull, req);
      const users = messages.map(m => m.message.user);
      if (audience && users) {
        fb.addUsersToAudience(audience, users);
      }
    }
  }));

  app.use("/admin", adminHandler({ Hull, facebookAppSecret, facebookAppId }));

  app.listen(port);

  return app;
}
