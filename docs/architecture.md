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

| Package            | Role                                                                 | Status                    |
| ------------------ | -------------------------------------------------------------------- | ------------------------- |
| `packages/gesture` | Shape rules and the per-hand state machine. Pure TypeScript, no DOM. | Built                     |
| `apps/server`      | Alert API, escalation engine, Socket.io, serves the built web app.   | Built                     |
| `apps/web`         | The five surfaces: Home, Eye, Command, Guard, Learn.                 | Eye, Command, Guard built |

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

## Security dashboard (`/command`)

- **Campus map** is an SVG drawn from the seed: buildings, roads, camera pins and guard posts. Pins are filled when the camera's Eye page is open, red with a pulse during an unanswered alert, and green once a guard is responding.
- **Alarm banner.** While any alert has no responder, a red banner names the camera and who is being rung. An optional alarm sound can be switched on; browsers only allow sound after a click.
- **Alert panel** shows the snapshot, status, a running timer, the ring timeline, and three actions: Call 112 (`tel:112`), Resolve and Mark false alarm. Resolve and false alarm ask for confirmation.
- **Alert log** lists the last 50 alerts with their response time. Picking one shows it in the panel; "Back to live" returns to the current alert.
- The panel follows the newest unanswered alert automatically and returns to "No active alerts" once it is closed.

## Guard app (`/guard`)

1. The guard picks their name and taps **Start shift**. That tap unlocks sound, which browsers block until the user interacts with the page. The screen is kept awake while on shift where the browser supports it.
2. When rung, the phone shows a full-screen alert with the location, a repeating ring, vibration and one large **I'm going** button, plus a countdown to the next guard.
3. After confirming, the guard sees the location, a timer, the Foundation's guidance (approach calmly, yes-or-no questions, let her lead) and a Call 112 button.
4. When security closes the alert, the guard is told and goes back to waiting.

If the connection drops, the page says so and rejoins the shift when it reconnects, picking up any ring already in progress.

## Phone calls (optional)

`src/services/twilio.ts` is a second ring channel next to the Guard app. It is switched on only when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, a public address (`PUBLIC_URL`, or Render's `RENDER_EXTERNAL_URL`) and at least one number in `GUARD_PHONES` are set. Otherwise the server logs that phone calls are off and nothing else changes.

```
engine rings guard --> Guard app (Socket.io)                        guard taps "I'm going" --> guard:ack
                   --> Twilio REST: create call with TwiML <Gather>
                         "Silent help signal at Parking, camera 4. Press 1 if you are going."
                         guard presses 1 --> POST /api/twilio/gather --> engine.acknowledge
ring ends or someone confirms --> Twilio REST: hang up the call
```

- Calls use Twilio's REST API directly with `fetch`; there is no SDK dependency.
- The webhook `POST /api/twilio/gather?alert=…&guard=…` checks the `X-Twilio-Signature` header (HMAC-SHA1 with the auth token) and answers with TwiML.
- If a ring stops before Twilio has returned the call id, the call is hung up as soon as the id arrives.
- A failed call is logged and the chain carries on through the Guard app.
- Each ring attempt records the channels that reached the guard (`guard-app`, `phone`), which the ring timeline shows.
- Guard numbers live only in server settings and never appear in `/api/state`.

## Progressive web app

The web app can be installed on phones and laptops, which matters most for the Guard app.

| File                          | Role                                                                |
| ----------------------------- | ------------------------------------------------------------------- |
| `public/manifest.webmanifest` | Name, colours, icons and shortcuts to Guard, Command, Eye and Learn |
| `public/icons/`               | SVG sources and PNG icons (192, 512, maskable 512, Apple touch 180) |
| `public/sw.js`                | Service worker                                                      |
| `src/lib/pwa.ts`              | Registers the worker in production and exposes the install prompt   |

The service worker loads pages network first and falls back to the cached app when offline. Hashed assets, icons and the MediaPipe files are cached on first use, so the camera page starts faster the second time. `/api` and `/socket.io` are never cached: alerts are always live. The server sends `no-cache` for `index.html`, `sw.js` and the manifest so updates reach devices on the next load. The worker is not registered during `pnpm dev`.

## Design system

The look comes from the Ishaara Figma Make design: a warm grey frame, soft cards with folder-tab notches, one molten orange hero surface per screen, and a dark "deck" card for the most important panel. Light and dark themes are both supported; the toggle in the top bar stores the choice per device.

All colours are CSS variables in `apps/web/src/styles/index.css`, defined once for light and again under `[data-theme="dark"]`, then exposed to Tailwind through `@theme inline`. The default Tailwind palette is switched off, so only these tokens can be used.

| Token                                 | Use                                          |
| ------------------------------------- | -------------------------------------------- |
| `backdrop`, `shell`, `card`, `sunken` | Page, frame, card and inset backgrounds      |
| `ink`, `ink-2`, `ink-3`, `line`       | Text and hairlines                           |
| `inverse`, `inverse-ink`, `tile`      | Dark deck cards and icon tiles               |
| `accent`, `accent-fill`, `accent-ink` | Unconfirmed alerts, ringing, primary actions |
| `gold`, `on-gold`, `gold-ink`         | Responding, confirmed and resolved           |

Status meaning: orange is an alert nobody has confirmed yet, gold is a guard responding or a confirmed step, ink is resolved, muted grey is a false alarm or offline.

UI primitives live in `apps/web/src/components/ui`: Button, Card, CardHead, Deck, Chip, Dialog, Dot, Dashes, IconTile, Kbd, Mark, Notice, PageHead, Segmented, Select, ServerProblem, Toggle. The app frame and navigation are in `components/shell/AppShell.tsx`. ### Motion

Motion is CSS and SVG only, with no animation library, and each effect marks a moment in the alert flow:

| Effect                                       | Where                                    | What it shows                                                                                                   |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Signal hand morph                            | Home hero, Learn practice, Eye stage bar | The palm, thumb-tuck and fold poses animate between each other; on Eye the hand follows the live detector state |
| 3D tilt with depth layers                    | Home hero, Learn step cards              | Cards rotate towards the mouse (mouse only, not touch) with the hand floating above the card                    |
| Staggered rise and count-up                  | Every page                               | Cards enter one after another; stat numbers count to their value                                                |
| Circular theme reveal                        | Theme toggle                             | The new theme spreads out from the button (View Transitions API, falls back to an instant switch)               |
| Shockwave and deal-in                        | Command                                  | A new alert sends a ring across the map from its camera and the alert card drops in with a slight 3D tilt       |
| Alarm halo                                   | App frame                                | The frame glows orange on every screen while any alert is unconfirmed                                           |
| Route markers                                | Campus map                               | A dot travels from the camera to the guard being rung, or from the responding guard to the camera               |
| Status ripple, countdown tick, success burst | Alert card, Guard ring, Eye and Learn    | Confirms a change of state                                                                                      |

The hooks (`useTilt`, `useCountUp`, `useReducedMotion`) are in `apps/web/src/lib/motion.ts`. Under `prefers-reduced-motion` every loop stops, tilt is disabled and entrances become a short fade.

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

| Event             | Direction           | Carries                                            |
| ----------------- | ------------------- | -------------------------------------------------- |
| `alert:new`       | Server to everyone  | The new alert                                      |
| `alert:update`    | Server to everyone  | The alert after any change                         |
| `guard:ring`      | Server to one guard | Alert id and number, camera label, zone, end time  |
| `guard:presence`  | Server to everyone  | Ids of guards on shift                             |
| `camera:presence` | Server to everyone  | Ids of cameras with an Eye page open               |
| `camera:join`     | Eye page to server  | `cameraId`: this device is now that camera         |
| `camera:leave`    | Eye page to server  | This device stopped being a camera                 |
| `guard:join`      | Guard app to server | `guardId`; the reply includes any ring in progress |
| `guard:leave`     | Guard app to server | Ends the shift on this device                      |
| `guard:ack`       | Guard app to server | `alertId`, `guardId`: "I'm going"                  |
| `alert:resolve`   | Dashboard to server | `alertId`, `outcome`: resolved or false alarm      |

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
- **Fonts are bundled.** Manrope ships with the app, so the UI looks the same on venue WiFi or offline.
