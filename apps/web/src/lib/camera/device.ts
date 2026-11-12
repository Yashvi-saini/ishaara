export interface CameraProfile {
  constraints: MediaStreamConstraints;
  frameLongSide: number;
  numHands: number;
}

const HANDHELD_QUERY = "(hover: none) and (pointer: coarse)";

const HANDHELD: CameraProfile = {
  constraints: {
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
    },
  },
  frameLongSide: 480,
  numHands: 1,
};

const DESKTOP: CameraProfile = {
  constraints: {
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  },
  frameLongSide: 640,
  numHands: 2,
};

export function isHandheld(): boolean {
  return typeof window !== "undefined" && window.matchMedia(HANDHELD_QUERY).matches;
}

export function cameraProfile(): CameraProfile {
  return isHandheld() ? HANDHELD : DESKTOP;
}
