import express, { Router, type ErrorRequestHandler } from "express";
import { toPublicConfig, type AppConfig } from "../config.js";
import type { Clock } from "../services/clock.js";
import type { EscalationEngine } from "../services/escalation.js";
import type { Presence } from "../sockets/index.js";
import type { Store } from "../store/store.js";
import type { Alert, ApiError, AppState, CreateAlertResponse, HealthResponse } from "../types.js";

const JPEG_PREFIX = "data:image/jpeg;base64,";
const MAX_SNAPSHOT_CHARS = 1_500_000;

export interface ApiDeps {
  config: AppConfig;
  store: Store;
  engine: EscalationEngine;
  clock: Clock;
  presence: Presence;
  onAlertCreated: (alert: Alert) => void;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseSnapshot(value: unknown): Parsed<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string" || !value.startsWith(JPEG_PREFIX)) {
    return { ok: false, error: "The snapshot must be a JPEG data URL." };
  }
  if (value.length > MAX_SNAPSHOT_CHARS) {
    return { ok: false, error: "The snapshot is too large." };
  }
  return { ok: true, value };
}

export function createApiRouter(deps: ApiDeps): Router {
  const { config, store, engine, clock, presence } = deps;
  const router = Router();
  router.use(express.json({ limit: "2mb" }));

  router.get("/health", (_req, res) => {
    const body: HealthResponse = { ok: true, config: toPublicConfig(config) };
    res.json(body);
  });

  router.get("/state", (_req, res) => {
    const body: AppState = {
      campus: store.campus,
      cameras: [...store.cameras],
      guards: [...store.guards],
      alerts: store.listAlerts(),
      guardsOnShift: presence.onShift(),
      config: toPublicConfig(config),
      serverTime: clock.now(),
    };
    res.json(body);
  });

  router.post("/alerts", (req, res) => {
    const body: unknown = req.body;
    const input =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    const camera = typeof input.cameraId === "string" ? store.getCamera(input.cameraId) : undefined;
    if (!camera) {
      res.status(400).json({ error: "Unknown camera." } satisfies ApiError);
      return;
    }
    const snapshot = parseSnapshot(input.snapshot);
    if (!snapshot.ok) {
      res.status(400).json({ error: snapshot.error } satisfies ApiError);
      return;
    }

    const now = clock.now();
    const existing = store.findOpenAlertFrom(camera.id, now - config.cameraCooldownMs);
    if (existing) {
      res.json({ alert: existing, duplicate: true } satisfies CreateAlertResponse);
      return;
    }

    const alert = store.addAlert({
      camera,
      snapshot: snapshot.value,
      source: input.simulated === true ? "simulated" : "camera",
      createdAt: now,
    });
    deps.onAlertCreated(alert);
    engine.start(alert.id);
    res.status(201).json({
      alert: store.getAlert(alert.id) ?? alert,
      duplicate: false,
    } satisfies CreateAlertResponse);
  });

  router.get("/alerts/:id/snapshot", (req, res) => {
    const snapshot = store.getSnapshot(req.params.id);
    if (!snapshot) {
      res.status(404).json({ error: "No snapshot for this alert." } satisfies ApiError);
      return;
    }
    res
      .type("image/jpeg")
      .set("Cache-Control", "private, max-age=300")
      .send(Buffer.from(snapshot.slice(JPEG_PREFIX.length), "base64"));
  });

  router.use((_req, res) => {
    res.status(404).json({ error: "Not found." } satisfies ApiError);
  });

  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = (error as { status?: number }).status;
    if (status === 413) {
      res.status(413).json({ error: "The snapshot is too large." } satisfies ApiError);
    } else if (status === 400) {
      res.status(400).json({ error: "The request body is not valid JSON." } satisfies ApiError);
    } else {
      console.error(error);
      res.status(500).json({ error: "Something went wrong on the server." } satisfies ApiError);
    }
  };
  router.use(onError);

  return router;
}
