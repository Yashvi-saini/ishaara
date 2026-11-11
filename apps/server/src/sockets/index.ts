import type { Server, Socket } from "socket.io";
import {
  toGuardRing,
  type EscalationEngine,
  type EscalationResult,
  type RingChannel,
} from "../services/escalation.js";
import type { Store } from "../store/store.js";
import type { ActionReply, ClientToServerEvents, ServerToClientEvents } from "../types.js";

interface SocketData {
  guardId?: string;
  cameraId?: string;
}

export type IshaaraIo = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type IshaaraSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export interface Presence {
  join(guardId: string, socketId: string): void;
  leave(guardId: string, socketId: string): void;
  isOnShift(guardId: string): boolean;
  onShift(): string[];
}

export function createPresence(): Presence {
  const devices = new Map<string, Set<string>>();
  return {
    join(guardId, socketId) {
      const sockets = devices.get(guardId) ?? new Set<string>();
      sockets.add(socketId);
      devices.set(guardId, sockets);
    },
    leave(guardId, socketId) {
      const sockets = devices.get(guardId);
      if (!sockets) return;
      sockets.delete(socketId);
      if (sockets.size === 0) devices.delete(guardId);
    },
    isOnShift: (guardId) => devices.has(guardId),
    onShift: () => [...devices.keys()],
  };
}

function guardRoom(guardId: string): string {
  return `guard:${guardId}`;
}

export function createGuardAppChannel(io: IshaaraIo, presence: Presence): RingChannel {
  return {
    name: "guard-app",
    ring({ guard, alert, startedAt, endsAt }) {
      io.to(guardRoom(guard.id)).emit("guard:ring", toGuardRing(alert, startedAt, endsAt));
      return presence.isOnShift(guard.id);
    },
    stop() {},
  };
}

export function toActionReply(
  result: EscalationResult,
  store: Store,
  alertId: string,
): ActionReply {
  if (result.ok) return result;
  switch (result.reason) {
    case "not_found":
      return { ok: false, error: "This alert no longer exists." };
    case "unknown_guard":
      return { ok: false, error: "This guard is not on the list." };
    case "closed":
      return { ok: false, error: "This alert is already closed." };
    case "already_claimed": {
      const responder = store.getAlert(alertId)?.responderName ?? "Another guard";
      return { ok: false, error: `${responder} is already on the way.` };
    }
  }
}

function field(payload: unknown, key: string): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export function registerSocketHandlers(
  io: IshaaraIo,
  deps: { store: Store; engine: EscalationEngine; presence: Presence; cameraPresence: Presence },
): void {
  const { store, engine, presence, cameraPresence } = deps;

  function stopCamera(socket: IshaaraSocket): void {
    const cameraId = socket.data.cameraId;
    if (!cameraId) return;
    socket.data.cameraId = undefined;
    cameraPresence.leave(cameraId, socket.id);
    io.emit("camera:presence", cameraPresence.onShift());
  }

  function endShift(socket: IshaaraSocket): void {
    const guardId = socket.data.guardId;
    if (!guardId) return;
    socket.data.guardId = undefined;
    void socket.leave(guardRoom(guardId));
    presence.leave(guardId, socket.id);
    io.emit("guard:presence", presence.onShift());
  }

  io.on("connection", (socket) => {
    socket.emit("guard:presence", presence.onShift());
    socket.emit("camera:presence", cameraPresence.onShift());

    socket.on("camera:join", (payload) => {
      const camera = store.getCamera(field(payload, "cameraId") ?? "");
      if (!camera) return;
      stopCamera(socket);
      socket.data.cameraId = camera.id;
      cameraPresence.join(camera.id, socket.id);
      io.emit("camera:presence", cameraPresence.onShift());
    });

    socket.on("camera:leave", () => stopCamera(socket));

    socket.on("guard:join", (payload, reply) => {
      const guard = store.getGuard(field(payload, "guardId") ?? "");
      if (!guard) {
        reply?.({ ok: false, error: "This guard is not on the list." });
        return;
      }
      endShift(socket);
      socket.data.guardId = guard.id;
      void socket.join(guardRoom(guard.id));
      presence.join(guard.id, socket.id);
      io.emit("guard:presence", presence.onShift());
      reply?.({ ok: true, guard, ring: engine.currentRingFor(guard.id) });
    });

    socket.on("guard:leave", () => endShift(socket));
    socket.on("disconnect", () => {
      endShift(socket);
      stopCamera(socket);
    });

    socket.on("guard:ack", (payload, reply) => {
      const alertId = field(payload, "alertId") ?? "";
      const guardId = field(payload, "guardId") ?? "";
      reply?.(toActionReply(engine.acknowledge(alertId, guardId), store, alertId));
    });

    socket.on("alert:resolve", (payload, reply) => {
      const alertId = field(payload, "alertId") ?? "";
      const outcome = field(payload, "outcome");
      if (outcome !== "resolved" && outcome !== "false_alarm") {
        reply?.({ ok: false, error: "Choose resolved or false alarm." });
        return;
      }
      reply?.(toActionReply(engine.resolve(alertId, outcome), store, alertId));
    });
  });
}
