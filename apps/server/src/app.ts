import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express, type Router } from "express";

const WEB_DIST = path.resolve(import.meta.dirname, "../../web/dist");

export function createApp(apiRouter: Router): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", apiRouter);

  if (existsSync(path.join(WEB_DIST, "index.html"))) {
    app.use(
      express.static(WEB_DIST, {
        setHeaders(res, filePath) {
          const name = path.basename(filePath);
          if (name === "sw.js" || name === "index.html" || name === "manifest.webmanifest") {
            res.setHeader("Cache-Control", "no-cache");
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(WEB_DIST, "index.html"));
    });
  }

  return app;
}
