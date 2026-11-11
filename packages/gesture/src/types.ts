export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export type HandLandmarks = readonly Landmark[];

export const LANDMARK_COUNT = 21;

export type Shape = "A" | "B" | "other";

export interface HandReading {
  shape: Shape;
  size: number;
  fingersOpen: readonly [boolean, boolean, boolean, boolean];
  fingersCurled: readonly [boolean, boolean, boolean, boolean];
  thumbRatio: number;
  thumbTucked: boolean;
}

export type SignalEvent =
  | { type: "step1"; handId: number; timestamp: number }
  | { type: "signal"; handId: number; timestamp: number }
  | { type: "timeout"; handId: number; timestamp: number };

export type DetectorStatus = "watching" | "step1" | "cooldown";
