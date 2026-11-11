# Architecture

This document is filled in as each phase lands. It describes what exists in the code today.

## Overview

Ishaara is one web app and one server, deployed as a single web service.

```
Camera device (browser)                Server (Node)                    Screens (browser)
-----------------------                -------------                    -----------------
/eye                                   Express + Socket.io              /command  security dashboard
  camera frames, in memory only   -->    alert API                 -->  /guard    rings a guard
  MediaPipe hand landmarks               escalation engine         <--            "I'm going"
  signal check (packages/gesture)        in-memory store
  one snapshot on a confirmed signal
```

The camera device decides whether a signal happened. The server only ever receives a confirmed alert with one snapshot, then drives the dashboard and the ring chain.

## Packages

| Package            | Role                                                                 | Status   |
| ------------------ | -------------------------------------------------------------------- | -------- |
| `packages/gesture` | Shape rules and the per-hand state machine. Pure TypeScript, no DOM. | Built    |
| `apps/server`      | Alert API, escalation engine, Socket.io, serves the built web app.   | Skeleton |
| `apps/web`         | The five surfaces: Home, Eye, Command, Guard, Learn.                 | Skeleton |

## Gesture detection

`packages/gesture` turns MediaPipe hand landmarks into a signal. It has no browser or MediaPipe dependency, so the same code runs in `/eye`, in `/learn` and in tests.

### Shape rules (`src/shape.ts`)

MediaPipe reports 21 points per hand. The rules use the wrist (0), the thumb tip (4), the four fingertips (8, 12, 16, 20), their middle joints (6, 10, 14, 18), the middle-finger base (9) and the ring-finger base (13).

| Check         | Rule                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| Hand size     | Distance from the wrist to the middle-finger base. Everything is relative.  |
| Finger open   | Fingertip farther from the wrist than its middle joint                      |
| Finger curled | Fingertip closer to the wrist than its middle joint                         |
| Thumb tucked  | Thumb tip within `thumbTuckRatio` (0.5) × hand size of the ring-finger base |
| Shape A       | Four fingers open and thumb tucked                                          |
| Shape B       | Four fingers curled and thumb tucked                                        |

Because every distance is divided by the hand size, the rules give the same answer for a hand near or far, tilted, upside down, or left or right. Landmarks are fractions of the image width and height, so the rules also take the image aspect ratio; without it, a sideways hand in a wide image would be measured wrongly.

### State machine (`src/detector.ts`)

`createSignalDetector(config)` returns a detector for one camera. Call `update(hands, timestamp)` once per video frame; it returns the events from that frame.

```
watching --(Shape A for 5 frames)--> step 1 --(Shape B for 5 frames, within 2 s)--> signal --> cooldown
                                        |
                                        +--(2 s pass, or the hand leaves)--> timeout --> watching
```

- **One state machine per hand.** Hands are followed between frames by wrist position, so Shape A from one person and Shape B from another never combine, even when MediaPipe lists the hands in a different order.
- **One shape alone never raises an alert.** A normal fist with the thumb lying across the fingers looks like Shape B to a 2D camera. It is harmless because a signal also needs Shape A first, and an ordinary open hand has the thumb out.
- **The window is measured from the last frame Shape A was held**, so holding the palm up for a while before folding still works.
- **Cooldown.** After a signal the detector ignores everything for 30 s (5 s in demo mode), so one gesture sends one alert.

Every number is in one config object (`src/config.ts`): `thumbTuckRatio`, `holdFrames`, `sequenceWindowMs`, `cooldownMs`, `aspectRatio`, `handLostMs`, `maxWristJump`.

### Tests

`tests/fixtures/hands.ts` defines hand poses (Shape A, Shape B, open palm, two kinds of normal fist, thumbs up, peace sign, pointing) and places them in an image at any position, size, rotation or handedness. The tests cover a valid signal, fists that must not trigger, an open palm alone, the two-second timeout, the cooldown, and two people in frame.

## Decisions so far

- **One deploy.** The server serves `apps/web/dist` and falls back to `index.html` for page routes, so client-side routes such as `/command` work on refresh.
- **Shared types without a shared package.** The web app imports `apps/server/src/types.ts` as types only. Nothing from the server is bundled into the browser.
- **No database.** Cameras and guards come from a seed JSON file; alerts live in memory. This keeps the demo free of external services that could fail.
- **Settings come from the server.** Demo mode and timer lengths are read from the server at runtime, so one build works in both modes.
- **Fonts are bundled.** IBM Plex Sans ships with the app, so the UI looks the same on venue WiFi or offline.
