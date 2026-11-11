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

| Package            | Role                                                                 | Status    |
| ------------------ | -------------------------------------------------------------------- | --------- |
| `packages/gesture` | Shape rules and the per-hand state machine. Pure TypeScript, no DOM. | Built     |
| `apps/server`      | Alert API, escalation engine, Socket.io, serves the built web app.   | Built     |
| `apps/web`         | The five surfaces: Home, Eye, Command, Guard, Learn.                 | Eye built |

## Camera page (`/eye`)

```
main thread                                      Web Worker
-----------                                      ----------
<video> from getUserMedia
  every frame: createImageBitmap (640 px wide) --> HandLandmarker.detectForVideo
                                              <--  21 landmarks per hand (up to 2 hands)
  createSignalDetector().update(hands, time)
  on "signal": one JPEG snapshot --> POST /api/alerts
```

- **MediaPipe runs in a Web Worker**, so detection never freezes the page. The worker asks for the next frame only after finishing the last one, which keeps the rate near 30 frames per second without a queue building up.
- **Mirroring.** Only the on-screen `<video>` and the tracking overlay are mirrored with CSS. The frame given to MediaPipe is never flipped.
- **Model files ship with the app.** `public/mediapipe/hand_landmarker.task` is committed. The WebAssembly runtime is copied from `node_modules` into `public/mediapipe/wasm` by `scripts/copy-mediapipe.mjs` before every dev run and build, so the version always matches the installed package and nothing is loaded from a CDN.
- **Snapshot.** The single image is taken from the same frame as the signal, scaled to 640 px wide, JPEG quality 0.75 (around 40 to 80 KB).
- **Demo mode** adds a "Simulate signal" button and the Shift+S shortcut, which send an alert marked as simulated, with a snapshot if the camera is running.
- **States the page handles:** camera starting, blocked, missing, in use by another app, insecure connection; hand tracking loading or failed; server unreachable; alert failed to send.

## Design system

All colours are CSS variables in `apps/web/src/styles/index.css` (Tailwind `@theme`). The default Tailwind palette is switched off, so only these tokens can be used.

| Token                           | Use                                   |
| ------------------------------- | ------------------------------------- |
| `canvas`, `surface`, `sunken`   | Page, card and inset backgrounds      |
| `line`, `line-strong`           | 1px borders                           |
| `ink`, `ink-muted`, `ink-faint` | Text                                  |
| `accent`                        | Primary actions and focus (deep blue) |
| `alert`                         | Active alert (red)                    |
| `ringing`                       | Ringing (amber)                       |
| `ok`                            | Responding or resolved (green)        |

UI primitives live in `apps/web/src/components/ui`: Button, Card, Dialog, EmptyState, PageHeader, Select, StatusDot, Toggle. Motion is limited to one alert flash and a ringing pulse, and both are switched off under `prefers-reduced-motion`.

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

## Server

`apps/server` is one Node process: Express for the REST API, Socket.io for live updates, and the escalation engine.

| File                         | Role                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| `src/server.ts`              | Wires the store, engine, API and sockets together                        |
| `src/routes/api.ts`          | REST routes                                                              |
| `src/sockets/index.ts`       | Socket.io events, guard shifts, the Guard app ring channel               |
| `src/services/escalation.ts` | The ring chain                                                           |
| `src/services/clock.ts`      | Real clock for the server, fake clock for tests                          |
| `src/store/store.ts`         | In-memory cameras, guards, alerts and snapshots                          |
| `src/seed/campus.json`       | The campus map, 6 cameras and 3 guards. Edit this file to match a campus |
| `src/types.ts`               | Types shared with the web app                                            |

### REST

| Route                          | What it does                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `POST /api/alerts`             | Body: `cameraId`, optional `snapshot` (JPEG data URL), optional `simulated`     |
| `GET /api/state`               | Campus, cameras, guards, alerts (newest first), guards on shift, settings, time |
| `GET /api/alerts/:id/snapshot` | The alert's snapshot as a JPEG                                                  |
| `GET /api/health`              | Health check for the host                                                       |

`POST /api/alerts` answers 201 with the new alert. If the same camera already has an open alert from within its cooldown, it answers 200 with that alert and `duplicate: true`, so one gesture can never create two alerts. Snapshots are stored apart from alerts and loaded by URL, which keeps live updates small.

### Socket.io events

| Event            | Direction           | Carries                                            |
| ---------------- | ------------------- | -------------------------------------------------- |
| `alert:new`      | Server to everyone  | The new alert                                      |
| `alert:update`   | Server to everyone  | The alert after any change                         |
| `guard:ring`     | Server to one guard | Alert id and number, camera label, zone, end time  |
| `guard:presence` | Server to everyone  | Ids of guards on shift                             |
| `guard:join`     | Guard app to server | `guardId`; the reply includes any ring in progress |
| `guard:leave`    | Guard app to server | Ends the shift on this device                      |
| `guard:ack`      | Guard app to server | `alertId`, `guardId`: "I'm going"                  |
| `alert:resolve`  | Dashboard to server | `alertId`, `outcome`: resolved or false alarm      |

### Escalation engine

```
alert arrives --> ring guard 1 --(no answer)--> ring guard 2 --(no answer)--> ring guard 3 --+
                     ^                                                                       |
                     +------------------- nobody confirmed: start again --------------------+

any guard taps "I'm going" --> responding (guard's name, timer starts) --> resolved or false alarm
```

- Guards are rung one at a time, nearest to the camera first, using the map positions in the seed.
- Each ring lasts 20 s, or 8 s in demo mode.
- The first "I'm going" wins. Later confirmations are told who is already on the way.
- If nobody confirms, the chain repeats until someone does or security closes the alert.
- The engine never contacts the police. Calling 112 is a button a person presses.
- Each ring is recorded with its outcome (no answer, confirmed, stopped) and whether the guard had the app open. That list is the ring timeline on the dashboard.
- Ring channels are pluggable. The Guard app is the only channel today; phone calls can be added as a second one without changing the engine.

The engine takes its clock as a parameter. Tests pass a fake clock and move time forward instantly, so the full chain is tested in milliseconds.

### Alert status

`new` → `ringing` → `responding` → `resolved` or `false_alarm`. An alert can be closed from any open status.

## Decisions so far

- **One deploy.** The server serves `apps/web/dist` and falls back to `index.html` for page routes, so client-side routes such as `/command` work on refresh.
- **Shared types without a shared package.** The web app imports `apps/server/src/types.ts` as types only. Nothing from the server is bundled into the browser.
- **No database.** Cameras and guards come from a seed JSON file; alerts live in memory. This keeps the demo free of external services that could fail.
- **Settings come from the server.** Demo mode and timer lengths are read from the server at runtime, so one build works in both modes.
- **Fonts are bundled.** IBM Plex Sans ships with the app, so the UI looks the same on venue WiFi or offline.
