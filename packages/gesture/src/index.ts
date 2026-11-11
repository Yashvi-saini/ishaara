export { DEFAULT_GESTURE_CONFIG, DEMO_COOLDOWN_MS, resolveConfig } from "./config";
export type { GestureConfig } from "./config";
export { createSignalDetector } from "./detector";
export type { SignalDetector, TrackedHand } from "./detector";
export { distance } from "./geometry";
export { classifyShape, LANDMARK, readHand } from "./shape";
export { LANDMARK_COUNT } from "./types";
export type {
  DetectorStatus,
  HandLandmarks,
  HandReading,
  Landmark,
  Shape,
  SignalEvent,
} from "./types";
