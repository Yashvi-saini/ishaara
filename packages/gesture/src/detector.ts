import { resolveConfig, type GestureConfig } from "./config";
import { distance } from "./geometry";
import { LANDMARK, readHand } from "./shape";
import type { DetectorStatus, HandLandmarks, HandReading, Landmark, SignalEvent } from "./types";

/** The state machine for one hand. */
interface HandTrack {
  id: number;
  wrist: Landmark;
  lastSeenAt: number;
  /** "idle" until Shape A has been held; then "sawA" while waiting for Shape B. */
  stage: "idle" | "sawA";
  /** When Shape A was last held. The window for Shape B is measured from here. */
  shapeAHeldAt: number;
  streakA: number;
  streakB: number;
}

/** One hand as the detector saw it in the latest frame. */
export interface TrackedHand {
  handId: number;
  reading: HandReading;
  stage: HandTrack["stage"];
}

export interface SignalDetector {
  /**
   * Feed one video frame. `hands` is the list of hands MediaPipe found (each a list of 21 landmarks)
   * and `timestamp` is the frame time in milliseconds. Returns what happened in this frame.
   */
  update(hands: readonly HandLandmarks[], timestamp: number): SignalEvent[];
  /** What the detector is doing at the given time. */
  status(timestamp: number): DetectorStatus;
  /** Milliseconds left before the detector accepts a new signal. 0 when it is watching. */
  cooldownRemaining(timestamp: number): number;
  /** The hands seen in the latest frame, in the same order they were given to `update`. */
  hands(): readonly TrackedHand[];
  /** Forget every hand and end any cooldown. */
  reset(): void;
  readonly config: Readonly<GestureConfig>;
}

/**
 * Creates a detector for one camera.
 *
 * Each hand gets its own state machine, so two people in frame cannot combine their shapes:
 * Shape A held for `holdFrames` frames, then Shape B held for `holdFrames` frames within
 * `sequenceWindowMs`, emits one `signal`. The detector then ignores everything for `cooldownMs`.
 */
export function createSignalDetector(overrides: Partial<GestureConfig> = {}): SignalDetector {
  const config = resolveConfig(overrides);

  let tracks: HandTrack[] = [];
  let latest: TrackedHand[] = [];
  let nextId = 1;
  let cooldownUntil = Number.NEGATIVE_INFINITY;
  let lastTimestamp = Number.NEGATIVE_INFINITY;

  function reset(): void {
    tracks = [];
    latest = [];
    cooldownUntil = Number.NEGATIVE_INFINITY;
    lastTimestamp = Number.NEGATIVE_INFINITY;
  }

  /** Pairs each hand in this frame with the track whose wrist was nearest, closest pairs first. */
  function matchTracks(wrists: readonly (Landmark | undefined)[]): (HandTrack | undefined)[] {
    const candidates: { track: HandTrack; handIndex: number; gap: number }[] = [];
    for (const track of tracks) {
      wrists.forEach((wrist, handIndex) => {
        if (!wrist) return;
        const gap = distance(track.wrist, wrist, config.aspectRatio);
        if (gap <= config.maxWristJump) candidates.push({ track, handIndex, gap });
      });
    }
    candidates.sort((a, b) => a.gap - b.gap);

    const matched: (HandTrack | undefined)[] = wrists.map(() => undefined);
    const taken = new Set<HandTrack>();
    for (const { track, handIndex } of candidates) {
      if (taken.has(track) || matched[handIndex]) continue;
      matched[handIndex] = track;
      taken.add(track);
    }
    return matched;
  }

  function update(hands: readonly HandLandmarks[], timestamp: number): SignalEvent[] {
    // A clock that jumps backwards means a new video source; start again.
    if (timestamp < lastTimestamp) {
      tracks = [];
      cooldownUntil = Number.NEGATIVE_INFINITY;
    }
    lastTimestamp = timestamp;
    latest = [];

    if (timestamp < cooldownUntil) return [];

    const events: SignalEvent[] = [];
    const readings = hands.map((landmarks) => readHand(landmarks, config));
    const wrists = hands.map((landmarks, index) =>
      (readings[index] as HandReading).size > 0 ? landmarks[LANDMARK.wrist] : undefined,
    );
    const matched = matchTracks(wrists);
    const seen = new Set<HandTrack>();

    for (const [index, reading] of readings.entries()) {
      const wrist = wrists[index];
      if (!wrist) continue;

      let track = matched[index];
      if (!track) {
        track = {
          id: nextId++,
          wrist,
          lastSeenAt: timestamp,
          stage: "idle",
          shapeAHeldAt: 0,
          streakA: 0,
          streakB: 0,
        };
        tracks.push(track);
      }
      seen.add(track);
      track.wrist = wrist;
      track.lastSeenAt = timestamp;
      track.streakA = reading.shape === "A" ? track.streakA + 1 : 0;
      track.streakB = reading.shape === "B" ? track.streakB + 1 : 0;

      if (track.streakA >= config.holdFrames) {
        if (track.stage === "idle") events.push({ type: "step1", handId: track.id, timestamp });
        track.stage = "sawA";
        track.shapeAHeldAt = timestamp;
      }

      if (track.stage === "sawA") {
        const sinceShapeA = timestamp - track.shapeAHeldAt;
        if (sinceShapeA > config.sequenceWindowMs) {
          track.stage = "idle";
          events.push({ type: "timeout", handId: track.id, timestamp });
        } else if (track.streakB >= config.holdFrames) {
          events.push({ type: "signal", handId: track.id, timestamp });
          cooldownUntil = timestamp + config.cooldownMs;
          tracks = [];
          latest = [];
          return events;
        }
      }

      latest.push({ handId: track.id, reading, stage: track.stage });
    }

    // Hands that were not in this frame. A hand that stays away is forgotten, and a hand
    // whose window has run out goes back to idle. Either way, step 1 is over.
    tracks = tracks.filter((track) => {
      if (seen.has(track)) return true;
      const lost = timestamp - track.lastSeenAt > config.handLostMs;
      const expired = timestamp - track.shapeAHeldAt > config.sequenceWindowMs;
      if (track.stage === "sawA" && (lost || expired)) {
        track.stage = "idle";
        events.push({ type: "timeout", handId: track.id, timestamp });
      }
      return !lost;
    });

    return events;
  }

  function status(timestamp: number): DetectorStatus {
    if (timestamp < cooldownUntil) return "cooldown";
    return tracks.some((track) => track.stage === "sawA") ? "step1" : "watching";
  }

  function cooldownRemaining(timestamp: number): number {
    return Math.max(0, cooldownUntil - timestamp);
  }

  return { update, status, cooldownRemaining, hands: () => latest, reset, config };
}
