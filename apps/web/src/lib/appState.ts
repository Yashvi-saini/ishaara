import type { Alert, AppState } from "@ishaara/server/types";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getState, SERVER_UNREACHABLE } from "./api";
import { socket } from "./socket";

export interface AppStore {
  status: "loading" | "ready" | "error";
  data: AppState | null;
  error: string | null;
  connected: boolean;
  clockOffset: number;
}

let store: AppStore = {
  status: "loading",
  data: null,
  error: null,
  connected: false,
  clockOffset: 0,
};
const listeners = new Set<() => void>();
let started = false;
let livePresence: Partial<Pick<AppState, "guardsOnShift" | "camerasOnline">> = {};

function update(patch: Partial<AppStore>): void {
  store = { ...store, ...patch };
  for (const listener of listeners) listener();
}

async function load(): Promise<void> {
  try {
    const loaded = await getState();
    const data = { ...loaded, ...livePresence };
    update({ status: "ready", data, error: null, clockOffset: loaded.serverTime - Date.now() });
  } catch (error) {
    if (store.data) return;
    update({
      status: "error",
      error: error instanceof Error ? error.message : SERVER_UNREACHABLE,
    });
  }
}

function upsertAlert(alert: Alert): void {
  if (!store.data) return;
  const alerts = [alert, ...store.data.alerts.filter((existing) => existing.id !== alert.id)].sort(
    (a, b) => b.number - a.number,
  );
  update({ data: { ...store.data, alerts } });
}

function start(): void {
  if (started) return;
  started = true;
  socket.on("connect", () => {
    update({ connected: true });
    void load();
  });
  socket.on("disconnect", () => {
    livePresence = {};
    update({ connected: false });
  });
  socket.on("alert:new", upsertAlert);
  socket.on("alert:update", upsertAlert);
  socket.on("guard:presence", (guardsOnShift) => {
    livePresence = { ...livePresence, guardsOnShift };
    if (store.data) update({ data: { ...store.data, guardsOnShift } });
  });
  socket.on("camera:presence", (camerasOnline) => {
    livePresence = { ...livePresence, camerasOnline };
    if (store.data) update({ data: { ...store.data, camerasOnline } });
  });
  socket.connect();
  void load();
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppStore {
  return useSyncExternalStore(subscribe, () => store);
}

export function retryLoad(): void {
  update({ status: store.data ? "ready" : "loading", error: null });
  void load();
}

export function serverNow(): number {
  return Date.now() + store.clockOffset;
}

export function useServerNow(intervalMs = 1000): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
