import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import { toPublicConfig, type AppConfig } from "./config.js";
import type { HealthResponse } from "./types.js";

/** Where `pnpm build` puts the web app, relative to this file in both src/ and dist/. */
const WEB_DIST = path.resolve(import.meta.dirname, "../../web/dist");

export function createApp(config: AppConfig): Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/api/health", (_req, res) => {
    const body: HealthResponse = { ok: true, config: toPublicConfig(config) };
    res.json(body);
  });

  // In production the same service serves the built web app, so there is one deploy.
  if (existsSync(path.join(WEB_DIST, "index.html"))) {
    app.use(express.static(WEB_DIST));
    app.use((req, res, next) => {
      const isPageRequest = req.method === "GET" && !req.path.startsWith("/api");
      if (!isPageRequest) return next();
      res.sendFile(path.join(WEB_DIST, "index.html"));
    });
  }

  return app;
}
