import type { Landmark } from "./types";

/**
 * Straight-line distance between two landmarks in the image plane.
 * Pass the image aspect ratio (width / height) so that distances are true in wide or tall images.
 */
export function distance(a: Landmark, b: Landmark, aspectRatio = 1): number {
  return Math.hypot((a.x - b.x) * aspectRatio, a.y - b.y);
}
