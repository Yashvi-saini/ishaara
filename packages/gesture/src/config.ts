export interface GestureConfig {
  thumbTuckRatio: number;
  holdFrames: number;
  sequenceWindowMs: number;
  cooldownMs: number;
  aspectRatio: number;
  handLostMs: number;
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

export const DEMO_COOLDOWN_MS = 5000;

export function resolveConfig(overrides: Partial<GestureConfig> = {}): GestureConfig {
  return { ...DEFAULT_GESTURE_CONFIG, ...overrides };
}
