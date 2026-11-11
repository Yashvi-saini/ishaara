/** One hand landmark as MediaPipe returns it: x and y are fractions of the image width and height. */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

/** The 21 landmarks of one hand, in MediaPipe order (0 is the wrist). */
export type HandLandmarks = readonly Landmark[];

/** Number of landmarks MediaPipe returns for each hand. */
export const LANDMARK_COUNT = 21;

/**
 * The two hand shapes that make up the Signal for Help.
 * "A" is an open palm with the thumb tucked in. "B" is the fingers folded down over the thumb.
 */
export type Shape = "A" | "B" | "other";

/** What the shape rules measured for one hand. Useful for drawing a tracking overlay and for tuning. */
export interface HandReading {
  shape: Shape;
  /** Wrist to middle-finger base. Every other distance is judged against this. */
  size: number;
  /** Index, middle, ring, little finger: tip farther from the wrist than its middle joint. */
  fingersOpen: readonly [boolean, boolean, boolean, boolean];
  /** Index, middle, ring, little finger: tip closer to the wrist than its middle joint. */
  fingersCurled: readonly [boolean, boolean, boolean, boolean];
  /** Thumb tip to ring-finger base, divided by hand size. Tucked when below the configured ratio. */
  thumbRatio: number;
  thumbTucked: boolean;
}

export type SignalEvent =
  /** Shape A has been held long enough. The hand now has a short window to fold into Shape B. */
  | { type: "step1"; handId: number; timestamp: number }
  /** The full signal was made: Shape A, then Shape B within the window. */
  | { type: "signal"; handId: number; timestamp: number }
  /** Shape A was seen but Shape B did not follow in time. */
  | { type: "timeout"; handId: number; timestamp: number };

/** What the detector is doing right now, for a status line. */
export type DetectorStatus = "watching" | "step1" | "cooldown";
