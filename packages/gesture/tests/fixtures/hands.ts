import type { HandLandmarks, Landmark } from "../../src";

/**
 * Hand poses for tests, as 21 landmarks in MediaPipe order.
 *
 * Poses are written in "hand units": the wrist is at (0, 0), the fingers point up (negative y,
 * as in an image), and the distance from the wrist to the middle-finger base is 1.
 * `place()` turns a pose into image coordinates the way MediaPipe would report it.
 */
type Point = readonly [x: number, y: number];

interface Pose {
  thumb: readonly [Point, Point, Point, Point];
  index: readonly [Point, Point, Point, Point];
  middle: readonly [Point, Point, Point, Point];
  ring: readonly [Point, Point, Point, Point];
  little: readonly [Point, Point, Point, Point];
}

type Finger = Pose["index"];
type Thumb = Pose["thumb"];

// Each finger is listed base, middle joint, upper joint, tip.
const straight = {
  index: [
    [-0.28, -0.95],
    [-0.32, -1.35],
    [-0.34, -1.6],
    [-0.35, -1.82],
  ],
  middle: [
    [0, -1],
    [0, -1.45],
    [0, -1.72],
    [0, -1.95],
  ],
  ring: [
    [0.25, -0.93],
    [0.28, -1.33],
    [0.3, -1.58],
    [0.31, -1.8],
  ],
  little: [
    [0.46, -0.8],
    [0.52, -1.1],
    [0.55, -1.3],
    [0.57, -1.48],
  ],
} as const satisfies Record<string, Finger>;

// Folded fingers: the tip comes back down towards the palm, below the middle joint.
const folded = {
  index: [
    [-0.28, -0.95],
    [-0.3, -1.15],
    [-0.28, -0.9],
    [-0.24, -0.7],
  ],
  middle: [
    [0, -1],
    [0, -1.2],
    [0, -0.92],
    [0, -0.68],
  ],
  ring: [
    [0.25, -0.93],
    [0.26, -1.12],
    [0.24, -0.86],
    [0.22, -0.66],
  ],
  little: [
    [0.46, -0.8],
    [0.48, -0.95],
    [0.44, -0.75],
    [0.4, -0.6],
  ],
} as const satisfies Record<string, Finger>;

const thumbs = {
  /** Folded across the palm, tip near the ring-finger base. */
  tucked: [
    [-0.22, -0.18],
    [-0.3, -0.48],
    [-0.1, -0.68],
    [0.1, -0.8],
  ],
  /** Spread away from the hand, as in a wave or a high-five. */
  out: [
    [-0.25, -0.15],
    [-0.45, -0.4],
    [-0.6, -0.62],
    [-0.72, -0.82],
  ],
  /** Resting against the side of the index finger. */
  alongside: [
    [-0.25, -0.15],
    [-0.4, -0.45],
    [-0.42, -0.72],
    [-0.42, -0.95],
  ],
  /** A normal fist: the thumb sits outside, beside the folded index finger. */
  outsideFist: [
    [-0.25, -0.2],
    [-0.45, -0.5],
    [-0.44, -0.8],
    [-0.36, -1.02],
  ],
  /** A normal fist where the thumb lies across the front of the index and middle fingers. */
  acrossFist: [
    [-0.25, -0.2],
    [-0.42, -0.5],
    [-0.38, -0.78],
    [-0.18, -0.92],
  ],
  /** Pointing straight up, as in a thumbs up. */
  up: [
    [-0.25, -0.2],
    [-0.4, -0.55],
    [-0.42, -0.95],
    [-0.42, -1.3],
  ],
} as const satisfies Record<string, Thumb>;

function pose(thumb: Thumb, fingers: Omit<Pose, "thumb">): Pose {
  return { thumb, ...fingers };
}

const poses = {
  /** Shape A: open palm, thumb tucked in. */
  shapeA: pose(thumbs.tucked, straight),
  /** Shape B: fingers folded down over the tucked thumb. */
  shapeB: pose(thumbs.tucked, folded),
  /** Halfway between A and B: the index finger is still up, the other three have folded. */
  halfFolded: pose(thumbs.tucked, { ...folded, index: straight.index }),
  /** A wave or a high-five: open palm with the thumb out. */
  openPalm: pose(thumbs.out, straight),
  /** A relaxed flat hand with the thumb resting beside the index finger. */
  flatHand: pose(thumbs.alongside, straight),
  /** A normal fist with the thumb outside, beside the index finger. */
  fistThumbOutside: pose(thumbs.outsideFist, folded),
  /** A normal fist with the thumb across the front of the fingers. In 2D this looks like Shape B. */
  fistThumbAcross: pose(thumbs.acrossFist, folded),
  thumbsUp: pose(thumbs.up, folded),
  /** Index and middle up, ring and little folded, thumb tucked. */
  peaceSign: pose(thumbs.tucked, { ...straight, ring: folded.ring, little: folded.little }),
  /** Index finger pointing, the rest folded. */
  pointing: pose(thumbs.outsideFist, { ...folded, index: straight.index }),
} as const;

export type PoseName = keyof typeof poses;

export interface Placement {
  /** Where the wrist sits in the image, as fractions of width and height. */
  at?: Point;
  /** Hand size as a fraction of the image height. */
  scale?: number;
  /** Clockwise rotation in degrees. */
  rotate?: number;
  /** Flip left to right, turning a right hand into a left hand. */
  mirror?: boolean;
  /** Image width divided by height. MediaPipe reports x as a fraction of the width. */
  aspectRatio?: number;
}

/** Places a pose in an image and returns the 21 landmarks MediaPipe would report. */
export function place(name: PoseName, placement: Placement = {}): HandLandmarks {
  const { at = [0.5, 0.7], scale = 0.2, rotate = 0, mirror = false, aspectRatio = 1 } = placement;
  const selected = poses[name];
  const points: Point[] = [
    [0, 0],
    ...selected.thumb,
    ...selected.index,
    ...selected.middle,
    ...selected.ring,
    ...selected.little,
  ];
  const angle = (rotate * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return points.map(([px, py]): Landmark => {
    const x = mirror ? -px : px;
    const rotatedX = x * cos - py * sin;
    const rotatedY = x * sin + py * cos;
    return {
      x: at[0] + (rotatedX * scale) / aspectRatio,
      y: at[1] + rotatedY * scale,
      z: 0,
    };
  });
}

export const POSE_NAMES = Object.keys(poses) as PoseName[];
