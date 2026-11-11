import { describe, expect, it } from "vitest";
import { guardsByDistance } from "../services/escalation.js";
import { loadSeed, validateSeed } from "./index.js";

describe("seed", () => {
  const seed = loadSeed();

  it("has the six campus cameras", () => {
    expect(seed.cameras.map((camera) => camera.name)).toEqual([
      "Main gate",
      "Library",
      "Girls' hostel entrance",
      "Parking",
      "Academic block",
      "Canteen",
    ]);
  });

  it("labels each camera with its place and number", () => {
    expect(seed.cameras.find((camera) => camera.id === "cam-4")?.label).toBe("Parking, camera 4");
  });

  it("has three guards, each with a name and a zone", () => {
    expect(seed.guards).toHaveLength(3);
    for (const guard of seed.guards) {
      expect(guard.name).not.toBe("");
      expect(guard.zone).not.toBe("");
    }
  });

  it("places every camera and guard on the map", () => {
    const { width, height } = seed.campus.map;
    for (const place of [...seed.cameras, ...seed.guards]) {
      expect(place.x).toBeGreaterThanOrEqual(0);
      expect(place.x).toBeLessThanOrEqual(width);
      expect(place.y).toBeGreaterThanOrEqual(0);
      expect(place.y).toBeLessThanOrEqual(height);
    }
  });

  it("gives every camera a different nearest-first guard order without ties", () => {
    for (const camera of seed.cameras) {
      const distances = seed.guards.map((guard) =>
        Math.hypot(guard.x - camera.x, guard.y - camera.y),
      );
      expect(new Set(distances).size).toBe(seed.guards.length);
    }
  });

  it("rings Anil, then Ramesh, then Sunita for the parking camera", () => {
    const parking = seed.cameras.find((camera) => camera.id === "cam-4");
    expect(parking).toBeDefined();
    if (!parking) return;
    expect(guardsByDistance(parking, seed.guards).map((guard) => guard.name)).toEqual([
      "Anil Yadav",
      "Ramesh Kumar",
      "Sunita Devi",
    ]);
  });

  it("uses the campus name from the environment when given", () => {
    expect(loadSeed("North campus").campus.name).toBe("North campus");
    expect(loadSeed().campus.name).toBe("Demo campus");
  });

  it("rejects a seed with duplicate ids", () => {
    const broken = loadSeed();
    const first = broken.cameras[0];
    if (first) broken.cameras.push({ ...first });
    expect(() => validateSeed(broken)).toThrow(/same id/);
  });

  it("rejects a seed with a camera off the map", () => {
    const broken = loadSeed();
    const first = broken.cameras[0];
    if (first) first.x = 5000;
    expect(() => validateSeed(broken)).toThrow(/outside the campus map/);
  });

  it("rejects a seed without guards", () => {
    expect(() => validateSeed({ ...loadSeed(), guards: [] })).toThrow(/at least one guard/);
  });
});
