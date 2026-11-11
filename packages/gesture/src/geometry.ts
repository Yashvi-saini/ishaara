import type { Landmark } from "./types";

export function distance(a: Landmark, b: Landmark, aspectRatio = 1): number {
  return Math.hypot((a.x - b.x) * aspectRatio, a.y - b.y);
}
