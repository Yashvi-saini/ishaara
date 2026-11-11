import { resolveConfig, type GestureConfig } from "./config";
import { distance } from "./geometry";
import { LANDMARK, readHand } from "./shape";
import type { DetectorStatus, HandLandmarks, HandReading, Landmark, SignalEvent } from "./types";

interface HandTrack {
  id: number;
  wrist: Landmark;
  lastSeenAt: number;
  stage: "idle" | "sawA";
  shapeAHeldAt: number;
  streakA: number;
  streakB: number;
}

export interface TrackedHand {
  handId: number;
  reading: HandReading;
  stage: HandTrack["stage"];
}

export interface SignalDetector {
  update(hands: readonly HandLandmarks[], timestamp: number): SignalEvent[];
  status(timestamp: number): DetectorStatus;
  cooldownRemaining(timestamp: number): number;
  hands(): readonly TrackedHand[];
  reset(): void;
  readonly config: Readonly<GestureConfig>;
}

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
