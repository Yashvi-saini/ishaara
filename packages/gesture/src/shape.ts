import { DEFAULT_GESTURE_CONFIG, type GestureConfig } from "./config";
import { distance } from "./geometry";
import { LANDMARK_COUNT, type HandLandmarks, type HandReading, type Landmark } from "./types";

export const LANDMARK = {
  wrist: 0,
  thumbTip: 4,
  middleFingerBase: 9,
  ringFingerBase: 13,
} as const;

const FINGERS = [
  { tip: 8, joint: 6 },
  { tip: 12, joint: 10 },
  { tip: 16, joint: 14 },
  { tip: 20, joint: 18 },
] as const;

type FourFlags = readonly [boolean, boolean, boolean, boolean];

const NOT_A_HAND: HandReading = {
  shape: "other",
  size: 0,
  fingersOpen: [false, false, false, false],
  fingersCurled: [false, false, false, false],
  thumbRatio: Number.POSITIVE_INFINITY,
  thumbTucked: false,
};

function isUsable(landmarks: HandLandmarks): boolean {
  return (
    landmarks.length >= LANDMARK_COUNT &&
    landmarks.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  );
}

export function readHand(
  landmarks: HandLandmarks,
  config: Pick<GestureConfig, "thumbTuckRatio" | "aspectRatio"> = DEFAULT_GESTURE_CONFIG,
): HandReading {
  if (!isUsable(landmarks)) return NOT_A_HAND;

  const point = (index: number): Landmark => landmarks[index] as Landmark;
  const between = (a: number, b: number): number =>
    distance(point(a), point(b), config.aspectRatio);

  const size = between(LANDMARK.wrist, LANDMARK.middleFingerBase);
  if (size <= 0) return NOT_A_HAND;

  const toWrist = FINGERS.map(({ tip, joint }) => ({
    tip: between(tip, LANDMARK.wrist),
    joint: between(joint, LANDMARK.wrist),
  }));
  const fingersOpen = toWrist.map((finger) => finger.tip > finger.joint) as unknown as FourFlags;
  const fingersCurled = toWrist.map((finger) => finger.tip < finger.joint) as unknown as FourFlags;

  const thumbRatio = between(LANDMARK.thumbTip, LANDMARK.ringFingerBase) / size;
  const thumbTucked = thumbRatio < config.thumbTuckRatio;

  const allOpen = fingersOpen.every(Boolean);
  const allCurled = fingersCurled.every(Boolean);
  const shape = thumbTucked && allOpen ? "A" : thumbTucked && allCurled ? "B" : "other";

  return { shape, size, fingersOpen, fingersCurled, thumbRatio, thumbTucked };
}

export function classifyShape(
  landmarks: HandLandmarks,
  config: Pick<GestureConfig, "thumbTuckRatio" | "aspectRatio"> = DEFAULT_GESTURE_CONFIG,
): HandReading["shape"] {
  return readHand(landmarks, config).shape;
}
