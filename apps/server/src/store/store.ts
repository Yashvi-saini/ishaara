import { randomUUID } from "node:crypto";
import type { Seed } from "../seed/index.js";
import type { Alert, AlertStatus, Camera, Campus, Guard } from "../types.js";

const OPEN_STATUSES: readonly AlertStatus[] = ["new", "ringing", "responding"];

export function isOpen(alert: Pick<Alert, "status">): boolean {
  return OPEN_STATUSES.includes(alert.status);
}

export interface NewAlert {
  camera: Camera;
  snapshot: string | null;
  source: Alert["source"];
  createdAt: number;
}

export interface Store {
  readonly campus: Campus;
  readonly cameras: readonly Camera[];
  readonly guards: readonly Guard[];
  getCamera(id: string): Camera | undefined;
  getGuard(id: string): Guard | undefined;
  listAlerts(): Alert[];
  getAlert(id: string): Alert | undefined;
  getSnapshot(alertId: string): string | undefined;
  findOpenAlertFrom(cameraId: string, since: number): Alert | undefined;
  addAlert(input: NewAlert): Alert;
  updateAlert(id: string, change: (alert: Alert) => Alert): Alert | undefined;
}

export function createStore(seed: Seed, options: { maxAlerts: number }): Store {
  const cameras = new Map(seed.cameras.map((camera) => [camera.id, camera]));
  const guards = new Map(seed.guards.map((guard) => [guard.id, guard]));
  let alerts: Alert[] = [];
  const snapshots = new Map<string, string>();
  let nextNumber = 1;

  function trim(): void {
    while (alerts.length > options.maxAlerts) {
      const oldestClosed = alerts.find((alert) => !isOpen(alert));
      const removed = oldestClosed ?? alerts[0];
      if (!removed) return;
      alerts = alerts.filter((alert) => alert !== removed);
      snapshots.delete(removed.id);
    }
  }

  return {
    campus: seed.campus,
    cameras: seed.cameras,
    guards: seed.guards,
    getCamera: (id) => cameras.get(id),
    getGuard: (id) => guards.get(id),
    listAlerts: () => [...alerts].reverse(),
    getAlert: (id) => alerts.find((alert) => alert.id === id),
    getSnapshot: (alertId) => snapshots.get(alertId),

    findOpenAlertFrom(cameraId, since) {
      return alerts.findLast(
        (alert) => alert.cameraId === cameraId && alert.createdAt >= since && isOpen(alert),
      );
    },

    addAlert({ camera, snapshot, source, createdAt }) {
      const id = randomUUID();
      const alert: Alert = {
        id,
        number: nextNumber++,
        cameraId: camera.id,
        cameraLabel: camera.label,
        zone: camera.zone,
        source,
        snapshotUrl: snapshot ? `/api/alerts/${id}/snapshot` : null,
        createdAt,
        status: "new",
        attempts: [],
        responderId: null,
        responderName: null,
        respondedAt: null,
        closedAt: null,
      };
      alerts.push(alert);
      if (snapshot) snapshots.set(id, snapshot);
      trim();
      return alert;
    },

    updateAlert(id, change) {
      const index = alerts.findIndex((alert) => alert.id === id);
      const current = alerts[index];
      if (!current) return undefined;
      const updated = change(current);
      alerts[index] = updated;
      return updated;
    },
  };
}
