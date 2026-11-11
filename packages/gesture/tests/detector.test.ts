import { describe, expect, it } from "vitest";
import {
  createSignalDetector,
  DEMO_COOLDOWN_MS,
  type HandLandmarks,
  type SignalDetector,
  type SignalEvent,
} from "../src";
import { place, type Placement, type PoseName } from "./fixtures/hands";

const FRAME_MS = 33;

type Step = [hands: PoseName | HandLandmarks[], frames: number];

function createPlayer(detector: SignalDetector, startAt = 0) {
  let now = startAt;
  const events: SignalEvent[] = [];

  return {
    events,
    get now() {
      return now;
    },
    play(...steps: Step[]) {
      for (const [hands, frames] of steps) {
        const landmarks = typeof hands === "string" ? [place(hands)] : hands;
        for (let frame = 0; frame < frames; frame += 1) {
          events.push(...detector.update(landmarks, now));
          now += FRAME_MS;
        }
      }
      return this;
    },
    wait(ms: number) {
      for (let waited = 0; waited < ms; waited += FRAME_MS) {
        events.push(...detector.update([], now));
        now += FRAME_MS;
      }
      return this;
    },
    count(type: SignalEvent["type"]) {
      return events.filter((event) => event.type === type).length;
    },
  };
}

const SIGNAL: Step[] = [
  ["shapeA", 8],
  ["halfFolded", 3],
  ["shapeB", 8],
];

describe("createSignalDetector", () => {
  describe("a valid signal", () => {
    it("emits step1 when the palm is held, then signal when the fingers fold", () => {
      const player = createPlayer(createSignalDetector()).play(...SIGNAL);
      expect(player.events.map((event) => event.type)).toEqual(["step1", "signal"]);
    });

    it("reports the same hand for both events", () => {
      const [step1, signal] = createPlayer(createSignalDetector()).play(...SIGNAL).events;
      expect(step1?.handId).toBe(signal?.handId);
    });

    it("needs exactly five frames of each shape", () => {
      const player = createPlayer(createSignalDetector()).play(["shapeA", 5], ["shapeB", 4]);
      expect(player.count("signal")).toBe(0);
      player.play(["shapeB", 1]);
      expect(player.count("signal")).toBe(1);
    });

    it("works with a left hand, a tilted hand and a hand far from the camera", () => {
      const placements: Placement[] = [
        { mirror: true },
        { rotate: 35 },
        { scale: 0.05, at: [0.2, 0.4] },
      ];
      for (const placement of placements) {
        const player = createPlayer(createSignalDetector()).play(
          [[place("shapeA", placement)], 6],
          [[place("shapeB", placement)], 6],
        );
        expect(player.count("signal")).toBe(1);
      }
    });

    it("works when the hand moves across the frame while signalling", () => {
      const detector = createSignalDetector();
      const player = createPlayer(detector);
      for (let frame = 0; frame < 16; frame += 1) {
        const pose = frame < 8 ? "shapeA" : "shapeB";
        player.play([[place(pose, { at: [0.3 + frame * 0.02, 0.7] })], 1]);
      }
      expect(player.count("signal")).toBe(1);
    });

    it("survives the hand going undetected for a frame or two", () => {
      const player = createPlayer(createSignalDetector())
        .play(["shapeA", 6])
        .wait(2 * FRAME_MS)
        .play(["shapeB", 6]);
      expect(player.count("signal")).toBe(1);
    });
  });

  describe("movements that must not raise an alert", () => {
    it("ignores a normal fist with the thumb outside", () => {
      const player = createPlayer(createSignalDetector()).play(
        ["openPalm", 15],
        ["fistThumbOutside", 30],
      );
      expect(player.events).toEqual([]);
    });

    it("ignores a normal fist with the thumb across the fingers, even though it looks like shape B", () => {
      const player = createPlayer(createSignalDetector()).play(
        ["openPalm", 15],
        ["fistThumbAcross", 60],
      );
      expect(player.events).toEqual([]);
    });

    it("ignores a fist that opens and closes repeatedly", () => {
      const player = createPlayer(createSignalDetector());
      for (let round = 0; round < 5; round += 1) {
        player.play(["openPalm", 10], ["fistThumbAcross", 10]);
      }
      expect(player.events).toEqual([]);
    });

    it("ignores an open palm on its own, however long it is held", () => {
      const player = createPlayer(createSignalDetector()).play(["openPalm", 120]);
      expect(player.events).toEqual([]);
    });

    it("sees step 1 but sends nothing when the tucked-thumb palm is held and then lowered", () => {
      const player = createPlayer(createSignalDetector()).play(["shapeA", 90]).wait(3000);
      expect(player.count("step1")).toBe(1);
      expect(player.count("signal")).toBe(0);
    });

    it("ignores the shapes in the wrong order", () => {
      const player = createPlayer(createSignalDetector()).play(["shapeB", 10], ["shapeA", 10]);
      expect(player.count("signal")).toBe(0);
    });

    it("ignores shape B on its own", () => {
      const player = createPlayer(createSignalDetector()).play(["shapeB", 120]);
      expect(player.events).toEqual([]);
    });

    it("ignores a palm that is not held long enough", () => {
      const player = createPlayer(createSignalDetector()).play(["shapeA", 4], ["shapeB", 10]);
      expect(player.events).toEqual([]);
    });

    it("ignores a flickering shape that never holds for five frames in a row", () => {
      const player = createPlayer(createSignalDetector());
      for (let round = 0; round < 10; round += 1) {
        player.play(["shapeA", 4], ["openPalm", 1]);
      }
      player.play(["shapeB", 10]);
      expect(player.events).toEqual([]);
    });

    it.each(["thumbsUp", "peaceSign", "pointing", "flatHand"] as const)(
      "ignores %s followed by a fist",
      (pose) => {
        const player = createPlayer(createSignalDetector()).play([pose, 20], ["shapeB", 20]);
        expect(player.count("signal")).toBe(0);
      },
    );
  });

  describe("the two-second window", () => {
    it("times out when the fingers fold too late", () => {
      const player = createPlayer(createSignalDetector()).play(
        ["shapeA", 6],
        ["halfFolded", 62],
        ["shapeB", 10],
      );
      expect(player.events.map((event) => event.type)).toEqual(["step1", "timeout"]);
    });

    it("accepts fingers that fold just inside the window", () => {
      const player = createPlayer(createSignalDetector()).play(
        ["shapeA", 6],
        ["halfFolded", 50],
        ["shapeB", 5],
      );
      expect(player.count("signal")).toBe(1);
    });

    it("measures the window from the last moment the palm was held, not the first", () => {
      const player = createPlayer(createSignalDetector()).play(["shapeA", 100], ["shapeB", 5]);
      expect(player.count("signal")).toBe(1);
    });

    it("times out when the hand leaves the frame after step 1", () => {
      const player = createPlayer(createSignalDetector()).play(["shapeA", 6]).wait(2500);
      expect(player.events.map((event) => event.type)).toEqual(["step1", "timeout"]);
    });

    it("lets the same hand start again after a timeout", () => {
      const player = createPlayer(createSignalDetector()).play(
        ["shapeA", 6],
        ["halfFolded", 70],
        ...SIGNAL,
      );
      expect(player.events.map((event) => event.type)).toEqual([
        "step1",
        "timeout",
        "step1",
        "signal",
      ]);
    });

    it("uses a configured window", () => {
      const player = createPlayer(createSignalDetector({ sequenceWindowMs: 500 })).play(
        ["shapeA", 6],
        ["halfFolded", 20],
        ["shapeB", 10],
      );
      expect(player.count("signal")).toBe(0);
    });
  });

  describe("cooldown", () => {
    it("sends one alert, not several, while the fist stays closed", () => {
      const player = createPlayer(createSignalDetector()).play(...SIGNAL, ["shapeB", 200]);
      expect(player.count("signal")).toBe(1);
    });

    it("ignores a second signal made during the 30 second cooldown", () => {
      const player = createPlayer(createSignalDetector())
        .play(...SIGNAL)
        .wait(10_000);
      player.play(...SIGNAL);
      expect(player.count("signal")).toBe(1);
      expect(player.count("step1")).toBe(1);
    });

    it("accepts a new signal once the cooldown has passed", () => {
      const player = createPlayer(createSignalDetector())
        .play(...SIGNAL)
        .wait(30_500);
      player.play(...SIGNAL);
      expect(player.count("signal")).toBe(2);
    });

    it("uses a 5 second cooldown in demo mode", () => {
      const detector = createSignalDetector({ cooldownMs: DEMO_COOLDOWN_MS });
      const player = createPlayer(detector)
        .play(...SIGNAL)
        .wait(3000);
      player.play(...SIGNAL);
      expect(player.count("signal")).toBe(1);

      player.wait(5000).play(...SIGNAL);
      expect(player.count("signal")).toBe(2);
    });

    it("does not carry a half-made signal across the cooldown", () => {
      const detector = createSignalDetector({ cooldownMs: 1000 });
      const player = createPlayer(detector).play(...SIGNAL);
      player.play(["shapeA", 28], ["shapeB", 10]);
      expect(player.count("signal")).toBe(1);
    });

    it("reports how long the cooldown has left", () => {
      const detector = createSignalDetector({ cooldownMs: 5000 });
      const player = createPlayer(detector).play(...SIGNAL);
      const signalAt = player.events.at(-1)?.timestamp ?? 0;
      expect(detector.cooldownRemaining(signalAt + 1000)).toBe(4000);
      expect(detector.cooldownRemaining(signalAt + 6000)).toBe(0);
    });
  });

  describe("more than one hand", () => {
    const left: Placement = { at: [0.25, 0.7] };
    const right: Placement = { at: [0.75, 0.7] };

    it("does not combine shape A from one person with shape B from another", () => {
      const player = createPlayer(createSignalDetector()).play(
        [[place("shapeA", left), place("openPalm", right)], 10],
        [[place("shapeA", left), place("shapeB", right)], 10],
      );
      expect(player.count("signal")).toBe(0);
    });

    it("detects one person signalling while another waves", () => {
      const player = createPlayer(createSignalDetector()).play(
        [[place("shapeA", left), place("openPalm", right)], 8],
        [[place("shapeB", left), place("openPalm", right)], 8],
      );
      expect(player.count("signal")).toBe(1);
    });

    it("keeps following each hand when MediaPipe lists them in a different order", () => {
      const detector = createSignalDetector();
      const player = createPlayer(detector);
      for (let frame = 0; frame < 16; frame += 1) {
        const signalling = place(frame < 8 ? "shapeA" : "shapeB", left);
        const waving = place("openPalm", right);
        player.play([frame % 2 === 0 ? [signalling, waving] : [waving, signalling], 1]);
      }
      expect(player.count("signal")).toBe(1);
    });

    it("does not let a second hand that appears mid-signal reset the first", () => {
      const player = createPlayer(createSignalDetector()).play(
        [[place("shapeA", left)], 8],
        [[place("shapeB", left), place("fistThumbOutside", right)], 8],
      );
      expect(player.count("signal")).toBe(1);
    });

    it("gives a different id to each hand", () => {
      const detector = createSignalDetector();
      detector.update([place("shapeA", left), place("openPalm", right)], 0);
      const ids = detector.hands().map((hand) => hand.handId);
      expect(new Set(ids).size).toBe(2);
    });

    it("forgets a hand that has been gone for a while, so a new hand starts from nothing", () => {
      const player = createPlayer(createSignalDetector())
        .play([[place("shapeA", left)], 8])
        .wait(800);
      player.play([[place("shapeB", left)], 10]);
      expect(player.count("signal")).toBe(0);
    });
  });

  describe("status", () => {
    it("moves from watching to step1 to cooldown and back to watching", () => {
      const detector = createSignalDetector({ cooldownMs: 1000 });
      const player = createPlayer(detector);
      expect(detector.status(player.now)).toBe("watching");

      player.play(["openPalm", 10]);
      expect(detector.status(player.now)).toBe("watching");

      player.play(["shapeA", 6]);
      expect(detector.status(player.now)).toBe("step1");

      player.play(["shapeB", 6]);
      expect(detector.status(player.now)).toBe("cooldown");

      player.wait(1100);
      expect(detector.status(player.now)).toBe("watching");
    });

    it("returns to watching after a timeout", () => {
      const detector = createSignalDetector();
      const player = createPlayer(detector).play(["shapeA", 6], ["openPalm", 70]);
      expect(detector.status(player.now)).toBe("watching");
    });

    it("exposes what it measured for each hand in the latest frame", () => {
      const detector = createSignalDetector();
      createPlayer(detector).play(["shapeA", 6]);
      const [hand] = detector.hands();
      expect(hand?.reading.shape).toBe("A");
      expect(hand?.stage).toBe("sawA");
    });
  });

  describe("reset and unusual input", () => {
    it("reset clears a half-made signal and any cooldown", () => {
      const detector = createSignalDetector();
      const player = createPlayer(detector).play(...SIGNAL);
      expect(detector.status(player.now)).toBe("cooldown");

      detector.reset();
      expect(detector.status(player.now)).toBe("watching");
      player.play(...SIGNAL);
      expect(player.count("signal")).toBe(2);
    });

    it("starts again when the clock jumps backwards", () => {
      const detector = createSignalDetector();
      createPlayer(detector, 100_000).play(["shapeA", 6]);
      const player = createPlayer(detector, 0).play(["shapeB", 10]);
      expect(player.count("signal")).toBe(0);
    });

    it("ignores hands with missing landmarks", () => {
      const detector = createSignalDetector();
      const broken = place("shapeA").slice(0, 10);
      expect(detector.update([broken], 0)).toEqual([]);
      expect(detector.hands()).toEqual([]);
    });

    it("handles frames with no hands", () => {
      const player = createPlayer(createSignalDetector()).wait(5000);
      expect(player.events).toEqual([]);
    });

    it("uses the default settings from the spec", () => {
      expect(createSignalDetector().config).toMatchObject({
        thumbTuckRatio: 0.5,
        holdFrames: 5,
        sequenceWindowMs: 2000,
        cooldownMs: 30_000,
      });
    });
  });
});
