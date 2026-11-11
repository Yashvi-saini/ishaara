import type { Camera, Campus, Guard } from "../types.js";
import campusSeed from "./campus.json" with { type: "json" };

export interface Seed {
  campus: Campus;
  cameras: Camera[];
  guards: Guard[];
}

function assertUniqueIds(kind: string, items: readonly { id: string }[]): void {
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error(`Seed has two ${kind} with the same id`);
}

export function validateSeed(seed: Seed): Seed {
  if (!seed.campus.name.trim()) throw new Error("Seed campus needs a name");
  if (seed.cameras.length === 0) throw new Error("Seed needs at least one camera");
  if (seed.guards.length === 0) throw new Error("Seed needs at least one guard");
  assertUniqueIds("cameras", seed.cameras);
  assertUniqueIds("guards", seed.guards);

  const { width, height } = seed.campus.map;
  for (const place of [...seed.cameras, ...seed.guards]) {
    const onMap = place.x >= 0 && place.x <= width && place.y >= 0 && place.y <= height;
    if (!onMap) throw new Error(`Seed places ${place.id} outside the campus map`);
  }
  return seed;
}

export function loadSeed(campusName?: string): Seed {
  const seed = structuredClone(campusSeed) as Seed;
  if (campusName) seed.campus.name = campusName;
  return validateSeed(seed);
}
