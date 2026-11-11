import { describe, expect, it } from "vitest";
import { loadSeed } from "../seed/index.js";
import { createStore } from "../store/store.js";
import type { Alert, Camera } from "../types.js";
import { createFakeClock } from "./clock.js";
import { createEscalationEngine, guardsByDistance, type RingChannel } from "./escalation.js";

const RING_MS = 20_000;
const ANIL = "guard-3";
const RAMESH = "guard-1";
const SUNITA = "guard-2";

interface Call {
  type: "ring" | "stop";
  guardId: string;
  alertId: string;
}

function setup(
  options: { ringMs?: number; reachable?: string[]; extraChannels?: RingChannel[] } = {},
) {
  const clock = createFakeClock(1_000_000);
  const store = createStore(loadSeed(), { maxAlerts: 50 });
  const calls: Call[] = [];
  const changes: Alert[] = [];
  const reachable = new Set(options.reachable ?? [ANIL, RAMESH, SUNITA]);

  const channel: RingChannel = {
    name: "test",
    ring({ guard, alert }) {
      calls.push({ type: "ring", guardId: guard.id, alertId: alert.id });
      return reachable.has(guard.id);
    },
    stop(guard, alert) {
      calls.push({ type: "stop", guardId: guard.id, alertId: alert.id });
    },
  };

  const engine = createEscalationEngine({
    store,
    clock,
    ringMs: options.ringMs ?? RING_MS,
    channels: [channel, ...(options.extraChannels ?? [])],
    onAlertChange: (alert) => changes.push(alert),
  });

  function raise(cameraId = "cam-4"): Alert {
    const alert = store.addAlert({
      camera: store.getCamera(cameraId) as Camera,
      snapshot: null,
      source: "camera",
      createdAt: clock.now(),
    });
    engine.start(alert.id);
    return alert;
  }

  const current = (alert: Alert) => store.getAlert(alert.id) as Alert;
  const rung = (alert?: Alert) =>
    calls
      .filter((call) => call.type === "ring" && (!alert || call.alertId === alert.id))
      .map((call) => call.guardId);
  const outcomes = (alert: Alert) =>
    current(alert).attempts.map((attempt) => `${attempt.guardId}:${attempt.outcome}`);

  return { clock, store, engine, calls, changes, raise, current, rung, outcomes };
}

describe("guardsByDistance", () => {
  const seed = loadSeed();
  const order = (cameraId: string) =>
    guardsByDistance(
      seed.cameras.find((camera) => camera.id === cameraId) as Camera,
      seed.guards,
    ).map((guard) => guard.id);

  it("puts the guard nearest the camera first", () => {
    expect(order("cam-4")).toEqual([ANIL, RAMESH, SUNITA]);
    expect(order("cam-1")).toEqual([RAMESH, ANIL, SUNITA]);
    expect(order("cam-3")).toEqual([SUNITA, ANIL, RAMESH]);
  });

  it("does not change the seed order", () => {
    const before = seed.guards.map((guard) => guard.id);
    order("cam-3");
    expect(seed.guards.map((guard) => guard.id)).toEqual(before);
  });
});

describe("escalation engine", () => {
  describe("ringing", () => {
    it("rings the nearest guard as soon as the alert starts", () => {
      const { raise, rung, current } = setup();
      const alert = raise();
      expect(rung()).toEqual([ANIL]);
      expect(current(alert).status).toBe("ringing");
    });

    it("records the ring with its start and end time", () => {
      const { raise, current, clock } = setup();
      const alert = raise();
      expect(current(alert).attempts).toEqual([
        {
          guardId: ANIL,
          guardName: "Anil Yadav",
          round: 1,
          startedAt: clock.now(),
          endsAt: clock.now() + RING_MS,
          endedAt: null,
          outcome: "ringing",
          reached: true,
          channels: ["test"],
        },
      ]);
    });

    it("rings only one guard at a time", () => {
      const { raise, clock, current } = setup();
      const alert = raise();
      for (let step = 0; step < 12; step += 1) {
        clock.advance(7000);
        const ringing = current(alert).attempts.filter((attempt) => attempt.outcome === "ringing");
        expect(ringing).toHaveLength(1);
      }
    });

    it("keeps ringing the same guard until the ring time is up", () => {
      const { raise, clock, rung } = setup();
      raise();
      clock.advance(RING_MS - 1);
      expect(rung()).toEqual([ANIL]);
    });

    it("moves to the next nearest guard when the first does not answer", () => {
      const { raise, clock, rung, outcomes, calls } = setup();
      const alert = raise();
      clock.advance(RING_MS);
      expect(rung()).toEqual([ANIL, RAMESH]);
      expect(outcomes(alert)).toEqual([`${ANIL}:no_answer`, `${RAMESH}:ringing`]);
      expect(calls).toContainEqual({ type: "stop", guardId: ANIL, alertId: alert.id });
    });

    it("stamps when an unanswered ring ended", () => {
      const { raise, clock, current } = setup();
      const alert = raise();
      const startedAt = clock.now();
      clock.advance(RING_MS);
      expect(current(alert).attempts[0]?.endedAt).toBe(startedAt + RING_MS);
    });

    it("rings every guard in order of distance", () => {
      const { raise, clock, rung } = setup();
      raise();
      clock.advance(RING_MS * 2);
      expect(rung()).toEqual([ANIL, RAMESH, SUNITA]);
    });

    it("uses the order for the camera that raised the alert", () => {
      const { raise, clock, rung } = setup();
      raise("cam-3");
      clock.advance(RING_MS * 2);
      expect(rung()).toEqual([SUNITA, ANIL, RAMESH]);
    });

    it("uses the shorter ring time in demo mode", () => {
      const { raise, clock, rung } = setup({ ringMs: 8000 });
      raise();
      clock.advance(7999);
      expect(rung()).toEqual([ANIL]);
      clock.advance(1);
      expect(rung()).toEqual([ANIL, RAMESH]);
    });

    it("notes when a guard could not be reached", () => {
      const { raise, clock, current } = setup({ reachable: [RAMESH] });
      const alert = raise();
      clock.advance(RING_MS);
      expect(current(alert).attempts.map((attempt) => attempt.reached)).toEqual([false, true]);
    });

    it("tells listeners every time the alert changes", () => {
      const { raise, clock, changes } = setup();
      raise();
      clock.advance(RING_MS);
      expect(changes.map((alert) => alert.attempts.length)).toEqual([1, 2]);
      expect(changes.every((alert) => alert.status === "ringing")).toBe(true);
    });
  });

  describe("when nobody confirms", () => {
    it("starts the chain again from the nearest guard", () => {
      const { raise, clock, rung } = setup();
      raise();
      clock.advance(RING_MS * 3);
      expect(rung()).toEqual([ANIL, RAMESH, SUNITA, ANIL]);
    });

    it("counts the rounds", () => {
      const { raise, clock, current } = setup();
      const alert = raise();
      clock.advance(RING_MS * 6);
      expect(current(alert).attempts.map((attempt) => attempt.round)).toEqual([
        1, 1, 1, 2, 2, 2, 3,
      ]);
    });

    it("keeps the alert ringing for as long as it takes", () => {
      const { raise, clock, rung, current } = setup();
      const alert = raise();
      clock.advance(RING_MS * 90);
      expect(rung()).toHaveLength(91);
      expect(current(alert).status).toBe("ringing");
      expect(current(alert).responderId).toBeNull();
    });
  });

  describe("when a guard confirms", () => {
    it("sets the alert to responding with the guard's name", () => {
      const { raise, engine, clock, current } = setup();
      const alert = raise();
      clock.advance(5000);
      const result = engine.acknowledge(alert.id, ANIL);
      expect(result.ok).toBe(true);
      expect(current(alert)).toMatchObject({
        status: "responding",
        responderId: ANIL,
        responderName: "Anil Yadav",
        respondedAt: clock.now(),
      });
    });

    it("marks the ring as confirmed and stops ringing", () => {
      const { raise, engine, clock, outcomes, rung, calls } = setup();
      const alert = raise();
      clock.advance(RING_MS + 3000);
      engine.acknowledge(alert.id, RAMESH);
      expect(outcomes(alert)).toEqual([`${ANIL}:no_answer`, `${RAMESH}:confirmed`]);
      expect(calls.at(-1)).toEqual({ type: "stop", guardId: RAMESH, alertId: alert.id });

      clock.advance(RING_MS * 10);
      expect(rung()).toEqual([ANIL, RAMESH]);
      expect(clock.pending()).toBe(0);
    });

    it("lets only the first guard win", () => {
      const { raise, engine, current } = setup();
      const alert = raise();
      expect(engine.acknowledge(alert.id, ANIL).ok).toBe(true);
      expect(engine.acknowledge(alert.id, RAMESH)).toEqual({
        ok: false,
        reason: "already_claimed",
      });
      expect(current(alert).responderName).toBe("Anil Yadav");
    });

    it("accepts a guard whose own ring has already run out", () => {
      const { raise, engine, clock, outcomes, current } = setup();
      const alert = raise();
      clock.advance(RING_MS + 2000);
      expect(engine.acknowledge(alert.id, ANIL).ok).toBe(true);
      expect(current(alert).responderName).toBe("Anil Yadav");
      expect(outcomes(alert)).toEqual([
        `${ANIL}:no_answer`,
        `${RAMESH}:stopped`,
        `${ANIL}:confirmed`,
      ]);
    });

    it("rejects a guard who is not on the list", () => {
      const { raise, engine, current } = setup();
      const alert = raise();
      expect(engine.acknowledge(alert.id, "guard-99")).toEqual({
        ok: false,
        reason: "unknown_guard",
      });
      expect(current(alert).status).toBe("ringing");
    });

    it("rejects an alert that does not exist", () => {
      const { engine } = setup();
      expect(engine.acknowledge("nope", ANIL)).toEqual({ ok: false, reason: "not_found" });
    });

    it("rejects a confirmation for an alert that is already closed", () => {
      const { raise, engine } = setup();
      const alert = raise();
      engine.resolve(alert.id, "false_alarm");
      expect(engine.acknowledge(alert.id, ANIL)).toEqual({ ok: false, reason: "closed" });
    });
  });

  describe("when security closes the alert", () => {
    it("stops ringing and marks the alert resolved", () => {
      const { raise, engine, clock, current, outcomes, rung } = setup();
      const alert = raise();
      clock.advance(4000);
      expect(engine.resolve(alert.id, "resolved").ok).toBe(true);
      expect(current(alert)).toMatchObject({ status: "resolved", closedAt: clock.now() });
      expect(outcomes(alert)).toEqual([`${ANIL}:stopped`]);

      clock.advance(RING_MS * 5);
      expect(rung()).toEqual([ANIL]);
      expect(clock.pending()).toBe(0);
    });

    it("can mark an alert as a false alarm", () => {
      const { raise, engine, current } = setup();
      const alert = raise();
      engine.resolve(alert.id, "false_alarm");
      expect(current(alert).status).toBe("false_alarm");
    });

    it("keeps the responder when resolving after a guard confirmed", () => {
      const { raise, engine, clock, current } = setup();
      const alert = raise();
      engine.acknowledge(alert.id, ANIL);
      clock.advance(120_000);
      engine.resolve(alert.id, "resolved");
      expect(current(alert)).toMatchObject({
        status: "resolved",
        responderName: "Anil Yadav",
        closedAt: clock.now(),
      });
    });

    it("refuses to close an alert twice", () => {
      const { raise, engine } = setup();
      const alert = raise();
      engine.resolve(alert.id, "resolved");
      expect(engine.resolve(alert.id, "false_alarm")).toEqual({ ok: false, reason: "closed" });
    });

    it("refuses to close an alert that does not exist", () => {
      const { engine } = setup();
      expect(engine.resolve("nope", "resolved")).toEqual({ ok: false, reason: "not_found" });
    });
  });

  describe("several alerts at once", () => {
    it("runs a separate chain for each alert", () => {
      const { raise, engine, clock, rung, current } = setup();
      const parking = raise("cam-4");
      clock.advance(5000);
      const hostel = raise("cam-3");

      engine.acknowledge(parking.id, ANIL);
      clock.advance(RING_MS);

      expect(current(parking).status).toBe("responding");
      expect(current(hostel).status).toBe("ringing");
      expect(rung(parking)).toEqual([ANIL]);
      expect(rung(hostel)).toEqual([SUNITA, ANIL]);
    });

    it("does not start the same alert twice", () => {
      const { raise, engine, rung } = setup();
      const alert = raise();
      engine.start(alert.id);
      engine.start(alert.id);
      expect(rung()).toEqual([ANIL]);
    });
  });

  describe("robustness", () => {
    it("carries on when a ring channel throws", () => {
      const broken: RingChannel = {
        name: "broken",
        ring() {
          throw new Error("phone line down");
        },
        stop() {
          throw new Error("phone line down");
        },
      };
      const { raise, clock, rung, current } = setup({ extraChannels: [broken] });
      const alert = raise();
      clock.advance(RING_MS);
      expect(rung()).toEqual([ANIL, RAMESH]);
      expect(current(alert).attempts[0]?.reached).toBe(true);
    });

    it("stops quietly when the alert has been dropped from the store", () => {
      const clock = createFakeClock();
      const store = createStore(loadSeed(), { maxAlerts: 1 });
      const rings: string[] = [];
      const engine = createEscalationEngine({
        store,
        clock,
        ringMs: RING_MS,
        channels: [{ name: "test", ring: ({ guard }) => rings.push(guard.id) > 0, stop() {} }],
      });
      const camera = store.getCamera("cam-4") as Camera;
      const first = store.addAlert({ camera, snapshot: null, source: "camera", createdAt: 0 });
      engine.start(first.id);
      store.addAlert({ camera, snapshot: null, source: "camera", createdAt: 1 });

      expect(store.getAlert(first.id)).toBeUndefined();
      expect(() => clock.advance(RING_MS * 3)).not.toThrow();
      expect(rings).toEqual([ANIL]);
      expect(clock.pending()).toBe(0);
    });

    it("reports the ring a guard should be hearing", () => {
      const { raise, engine, clock } = setup();
      const alert = raise();
      expect(engine.currentRingFor(ANIL)).toMatchObject({
        alertId: alert.id,
        alertNumber: 1,
        cameraLabel: "Parking, camera 4",
        endsAt: clock.now() + RING_MS,
      });
      expect(engine.currentRingFor(RAMESH)).toBeNull();

      clock.advance(RING_MS);
      expect(engine.currentRingFor(ANIL)).toBeNull();
      expect(engine.currentRingFor(RAMESH)?.alertId).toBe(alert.id);

      engine.acknowledge(alert.id, RAMESH);
      expect(engine.currentRingFor(RAMESH)).toBeNull();
    });

    it("cancels every timer on shutdown", () => {
      const { raise, engine, clock, rung } = setup();
      raise("cam-4");
      raise("cam-3");
      engine.shutdown();
      expect(clock.pending()).toBe(0);
      clock.advance(RING_MS * 5);
      expect(rung()).toEqual([ANIL, SUNITA]);
    });
  });
});
