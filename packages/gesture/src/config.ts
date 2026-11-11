/** Every number the detector uses. Change these to tune detection; nothing else is hard-coded. */
export interface GestureConfig {
  /**
   * The thumb counts as tucked when the thumb tip is within this fraction of the hand size
   * from the ring-finger base. Lower is stricter. This is the value most likely to need tuning.
   */
  thumbTuckRatio: number;
  /** How many frames in a row a shape must be seen before it counts as held. */
  holdFrames: number;
  /** Shape B must be held within this long after Shape A was last held, in milliseconds. */
  sequenceWindowMs: number;
  /** After a signal, the detector ignores everything for this long, in milliseconds. */
  cooldownMs: number;
  /**
   * Image width divided by height. Landmarks are fractions of width and height, so in a
   * wide image horizontal distances look shorter than they are. Setting this corrects for it.
   */
  aspectRatio: number;
  /** A hand that has not been seen for this long is forgotten, in milliseconds. */
  handLostMs: number;
  /**
   * How far a wrist may move between two frames and still count as the same hand,
   * as a fraction of the image height.
   */
  maxWristJump: number;
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  thumbTuckRatio: 0.5,
  holdFrames: 5,
  sequenceWindowMs: 2000,
  cooldownMs: 30_000,
  aspectRatio: 1,
  handLostMs: 500,
  maxWristJump: 0.25,
};

/** Cooldown used in demo mode, so a presenter can repeat the signal quickly. */
export const DEMO_COOLDOWN_MS = 5000;

export function resolveConfig(overrides: Partial<GestureConfig> = {}): GestureConfig {
  return { ...DEFAULT_GESTURE_CONFIG, ...overrides };
}
