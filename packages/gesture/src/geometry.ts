import type { Landmark } from "./types";

/** Straight-line distance between two landmarks in the image plane. */
export function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
