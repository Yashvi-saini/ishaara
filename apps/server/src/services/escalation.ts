import { isOpen, type Store } from "../store/store.js";
import type { Alert, AlertOutcome, Camera, Guard, GuardRing, RingOutcome } from "../types.js";
import type { Clock, TimerHandle } from "./clock.js";

export interface RingRequest {
  guard: Guard;
  alert: Alert;
  startedAt: number;
  endsAt: number;
}

export interface RingChannel {
  name: string;
  ring(request: RingRequest): boolean;
  stop(guard: Guard, alert: Alert): void;
}

export type EscalationResult =
  | { ok: true; alert: Alert }
  | { ok: false; reason: "not_found" | "unknown_guard" | "already_claimed" | "closed" };

export interface EscalationEngine {
  start(alertId: string): void;
  acknowledge(alertId: string, guardId: string): EscalationResult;
  resolve(alertId: string, outcome: AlertOutcome): EscalationResult;
  currentRingFor(guardId: string): GuardRing | null;
  shutdown(): void;
}

export interface EscalationDeps {
  store: Store;
  clock: Clock;
  ringMs: number;
  channels: readonly RingChannel[];
  onAlertChange?: (alert: Alert) => void;
}

export function guardsByDistance(camera: Camera, guards: readonly Guard[]): Guard[] {
  const distance = (guard: Guard) => Math.hypot(guard.x - camera.x, guard.y - camera.y);
  return [...guards].sort((a, b) => distance(a) - distance(b));
}

interface Chain {
  alertId: string;
  order: Guard[];
  index: number;
  round: number;
  timer: TimerHandle | null;
}

export function createEscalationEngine(deps: EscalationDeps): EscalationEngine {
  const { store, clock, ringMs, channels } = deps;
  const chains = new Map<string, Chain>();

  function publish(alert: Alert | undefined): void {
    if (alert) deps.onAlertChange?.(alert);
  }

  function ringOn(channel: RingChannel, request: RingRequest): boolean {
    try {
      return channel.ring(request);
    } catch (error) {
      console.error(`Ring channel "${channel.name}" failed to ring`, error);
      return false;
    }
  }

  function stopChannels(guardId: string, alert: Alert): void {
    const guard = store.getGuard(guardId);
    if (!guard) return;
    for (const channel of channels) {
      try {
        channel.stop(guard, alert);
      } catch (error) {
        console.error(`Ring channel "${channel.name}" failed to stop`, error);
      }
    }
  }

  function ringingAttempt(alert: Alert) {
    return alert.attempts.find((attempt) => attempt.outcome === "ringing");
  }

  function endRing(alert: Alert, outcome: Exclude<RingOutcome, "ringing">): Alert {
    const current = ringingAttempt(alert);
    if (!current) return alert;
    stopChannels(current.guardId, alert);
    return {
      ...alert,
      attempts: alert.attempts.map((attempt) =>
        attempt === current ? { ...attempt, outcome, endedAt: clock.now() } : attempt,
      ),
    };
  }

  function dropChain(alertId: string): void {
    const chain = chains.get(alertId);
    if (chain && chain.timer !== null) clock.clearTimeout(chain.timer);
    chains.delete(alertId);
  }

  function ringCurrentGuard(chain: Chain): void {
    const alert = store.getAlert(chain.alertId);
    const guard = chain.order[chain.index];
    if (!alert || !guard || !isOpen(alert)) {
      dropChain(chain.alertId);
      return;
    }

    const startedAt = clock.now();
    const request: RingRequest = { guard, alert, startedAt, endsAt: startedAt + ringMs };
    const reached = channels.map((channel) => ringOn(channel, request)).some(Boolean);

    const updated = store.updateAlert(alert.id, (current) => ({
      ...current,
      status: "ringing",
      attempts: [
        ...current.attempts,
        {
          guardId: guard.id,
          guardName: guard.name,
          round: chain.round,
          startedAt,
          endsAt: request.endsAt,
          endedAt: null,
          outcome: "ringing",
          reached,
        },
      ],
    }));
    chain.timer = clock.setTimeout(() => onNoAnswer(chain), ringMs);
    publish(updated);
  }

  function onNoAnswer(chain: Chain): void {
    chain.timer = null;
    const updated = store.updateAlert(chain.alertId, (alert) => endRing(alert, "no_answer"));
    if (!updated) {
      dropChain(chain.alertId);
      return;
    }
    chain.index += 1;
    if (chain.index >= chain.order.length) {
      chain.index = 0;
      chain.round += 1;
    }
    ringCurrentGuard(chain);
  }

  return {
    start(alertId) {
      const alert = store.getAlert(alertId);
      if (!alert || alert.status !== "new" || chains.has(alertId)) return;
      const camera = store.getCamera(alert.cameraId);
      if (!camera) return;

      const chain: Chain = {
        alertId,
        order: guardsByDistance(camera, store.guards),
        index: 0,
        round: 1,
        timer: null,
      };
      chains.set(alertId, chain);
      ringCurrentGuard(chain);
    },

    acknowledge(alertId, guardId) {
      const alert = store.getAlert(alertId);
      if (!alert) return { ok: false, reason: "not_found" };
      const guard = store.getGuard(guardId);
      if (!guard) return { ok: false, reason: "unknown_guard" };
      if (alert.status === "responding") return { ok: false, reason: "already_claimed" };
      if (!isOpen(alert)) return { ok: false, reason: "closed" };

      dropChain(alertId);
      const now = clock.now();
      const updated = store.updateAlert(alertId, (current) => {
        const ringing = ringingAttempt(current);
        const wasBeingRung = ringing?.guardId === guard.id;
        const ended = endRing(current, wasBeingRung ? "confirmed" : "stopped");
        return {
          ...ended,
          status: "responding",
          responderId: guard.id,
          responderName: guard.name,
          respondedAt: now,
          attempts: wasBeingRung
            ? ended.attempts
            : [
                ...ended.attempts,
                {
                  guardId: guard.id,
                  guardName: guard.name,
                  round: ringing?.round ?? 1,
                  startedAt: now,
                  endsAt: now,
                  endedAt: now,
                  outcome: "confirmed",
                  reached: true,
                },
              ],
        };
      });
      if (!updated) return { ok: false, reason: "not_found" };
      publish(updated);
      return { ok: true, alert: updated };
    },

    resolve(alertId, outcome) {
      const alert = store.getAlert(alertId);
      if (!alert) return { ok: false, reason: "not_found" };
      if (!isOpen(alert)) return { ok: false, reason: "closed" };

      dropChain(alertId);
      const updated = store.updateAlert(alertId, (current) => ({
        ...endRing(current, "stopped"),
        status: outcome,
        closedAt: clock.now(),
      }));
      if (!updated) return { ok: false, reason: "not_found" };
      publish(updated);
      return { ok: true, alert: updated };
    },

    currentRingFor(guardId) {
      for (const chain of chains.values()) {
        const alert = store.getAlert(chain.alertId);
        const ringing = alert && ringingAttempt(alert);
        if (alert && ringing?.guardId === guardId) {
          return toGuardRing(alert, ringing.startedAt, ringing.endsAt);
        }
      }
      return null;
    },

    shutdown() {
      for (const alertId of [...chains.keys()]) dropChain(alertId);
    },
  };
}

export function toGuardRing(alert: Alert, startedAt: number, endsAt: number): GuardRing {
  return {
    alertId: alert.id,
    alertNumber: alert.number,
    cameraLabel: alert.cameraLabel,
    zone: alert.zone,
    createdAt: alert.createdAt,
    startedAt,
    endsAt,
  };
}
