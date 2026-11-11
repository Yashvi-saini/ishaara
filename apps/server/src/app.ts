import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express, type Router } from "express";

const WEB_DIST = path.resolve(import.meta.dirname, "../../web/dist");

export function createApp(apiRouter: Router): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", apiRouter);

  if (existsSync(path.join(WEB_DIST, "index.html"))) {
    app.use(express.static(WEB_DIST));
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(path.join(WEB_DIST, "index.html"));
    });
  }

  return app;
}
