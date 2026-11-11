import { describe, expect, it } from "vitest";
import { classifyShape, LANDMARK_COUNT, readHand, type Shape } from "../src";
import { place, POSE_NAMES, type Placement, type PoseName } from "./fixtures/hands";

const expected: Record<PoseName, Shape> = {
  shapeA: "A",
  shapeB: "B",
  halfFolded: "other",
  openPalm: "other",
  flatHand: "other",
  fistThumbOutside: "other",
  // The thumb lies in front of the fingers, which a 2D camera cannot tell from a tucked thumb.
  // This is why one shape alone never raises an alert: see the detector tests.
  fistThumbAcross: "B",
  thumbsUp: "other",
  peaceSign: "other",
  pointing: "other",
};

describe("classifyShape", () => {
  it.each(POSE_NAMES)("reads %s correctly", (name) => {
    expect(classifyShape(place(name))).toBe(expected[name]);
  });

  it("gives every fixture 21 landmarks", () => {
    for (const name of POSE_NAMES) expect(place(name)).toHaveLength(LANDMARK_COUNT);
  });

  it("rejects a normal fist with the thumb outside", () => {
    const reading = readHand(place("fistThumbOutside"));
    expect(reading.fingersCurled).toEqual([true, true, true, true]);
    expect(reading.thumbTucked).toBe(false);
    expect(reading.shape).toBe("other");
  });

  it("rejects an open palm with the thumb out", () => {
    const reading = readHand(place("openPalm"));
    expect(reading.fingersOpen).toEqual([true, true, true, true]);
    expect(reading.thumbTucked).toBe(false);
    expect(reading.shape).toBe("other");
  });

  const placements: [string, Placement][] = [
    ["far from the camera", { scale: 0.04 }],
    ["close to the camera", { scale: 0.35, at: [0.5, 0.85] }],
    ["in a corner of the frame", { at: [0.15, 0.3], scale: 0.1 }],
    ["tilted 30 degrees", { rotate: 30 }],
    ["tilted the other way", { rotate: -45 }],
    ["sideways", { rotate: 90 }],
    ["upside down", { rotate: 180 }],
    ["as a left hand", { mirror: true }],
    ["as a tilted left hand", { mirror: true, rotate: 20, scale: 0.12 }],
  ];

  describe.each(placements)("with the hand %s", (_label, placement) => {
    it.each(POSE_NAMES)("still reads %s correctly", (name) => {
      expect(classifyShape(place(name, placement))).toBe(expected[name]);
    });
  });

  describe("in a wide 16:9 image", () => {
    const aspectRatio = 16 / 9;

    it.each(POSE_NAMES)("reads a sideways %s correctly when given the aspect ratio", (name) => {
      const landmarks = place(name, { rotate: 90, aspectRatio });
      expect(classifyShape(landmarks, { thumbTuckRatio: 0.5, aspectRatio })).toBe(expected[name]);
    });

    it("measures the same hand size at any rotation", () => {
      const upright = readHand(place("shapeA", { aspectRatio }), {
        thumbTuckRatio: 0.5,
        aspectRatio,
      });
      const sideways = readHand(place("shapeA", { rotate: 90, aspectRatio }), {
        thumbTuckRatio: 0.5,
        aspectRatio,
      });
      expect(sideways.size).toBeCloseTo(upright.size);
      expect(sideways.thumbRatio).toBeCloseTo(upright.thumbRatio);
    });
  });

  describe("thumb threshold", () => {
    it("reports the thumb distance as a fraction of hand size", () => {
      expect(readHand(place("shapeA")).thumbRatio).toBeCloseTo(0.2, 1);
      expect(readHand(place("openPalm")).thumbRatio).toBeGreaterThan(0.9);
    });

    it("is configurable: a stricter ratio rejects a loosely tucked thumb", () => {
      const landmarks = place("shapeA");
      expect(classifyShape(landmarks, { thumbTuckRatio: 0.5, aspectRatio: 1 })).toBe("A");
      expect(classifyShape(landmarks, { thumbTuckRatio: 0.1, aspectRatio: 1 })).toBe("other");
    });

    it("is configurable: a looser ratio accepts a thumb resting beside the index finger", () => {
      const landmarks = place("flatHand");
      expect(classifyShape(landmarks, { thumbTuckRatio: 0.5, aspectRatio: 1 })).toBe("other");
      expect(classifyShape(landmarks, { thumbTuckRatio: 0.8, aspectRatio: 1 })).toBe("A");
    });
  });

  describe("bad input", () => {
    it("returns other for a hand with missing landmarks", () => {
      expect(classifyShape(place("shapeA").slice(0, 20))).toBe("other");
      expect(classifyShape([])).toBe("other");
    });

    it("returns other when a coordinate is not a number", () => {
      const landmarks = [...place("shapeA")];
      landmarks[4] = { x: Number.NaN, y: 0.5 };
      expect(classifyShape(landmarks)).toBe("other");
    });

    it("returns other when every landmark is the same point", () => {
      const landmarks = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5 }));
      expect(classifyShape(landmarks)).toBe("other");
    });
  });
});
