import { describe, expect, it } from "vitest";
import { distance } from "../src";

describe("distance", () => {
  it("measures the straight line between two landmarks", () => {
    expect(distance({ x: 0, y: 0 }, { x: 0.3, y: 0.4 })).toBeCloseTo(0.5);
  });

  it("ignores depth", () => {
    expect(distance({ x: 0.1, y: 0.1, z: 0 }, { x: 0.1, y: 0.1, z: 5 })).toBe(0);
  });
});
