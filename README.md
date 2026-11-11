# Ishaara

Help without saying a word.

Ishaara lets a woman ask for help silently, with one hand sign, using cameras that already exist around her. A camera running Ishaara recognises the international [Signal for Help](https://canadianwomen.org/signal-for-help/), alerts campus security with the location and one snapshot, and keeps ringing guards until one confirms they are responding.

Built for HerHack 2026 (Student Innovation track).

## Status

Work in progress. The project is built in phases; this list is updated as each one lands.

- [x] Phase 0: workspace, tooling and CI
- [x] Phase 1: gesture engine
- [ ] Phase 2: server and escalation engine
- [ ] Phase 3: design system and Ishaara Eye
- [ ] Phase 4: Ishaara Command and the Guard app
- [ ] Phase 5: Learn and Home
- [ ] Phase 6: polish and deploy

## How it works

1. She makes the signal towards a camera: palm open with the thumb tucked in, then fingers folded down over the thumb.
2. Ishaara Eye recognises the two shapes in order and sends one snapshot with the camera's location. No video is recorded and no faces are identified.
3. Ishaara Command shows the alert on the campus map and rings guards one at a time until one taps "I'm going".

## Surfaces

| Route      | Name            | Used by            | What it does                                               |
| ---------- | --------------- | ------------------ | ---------------------------------------------------------- |
| `/eye`     | Ishaara Eye     | Any camera device  | Watches live video in the browser and sends one snapshot   |
| `/command` | Ishaara Command | Security room      | Campus map, live alert, ring timeline, responder and timer |
| `/guard`   | Guard app       | Guards, on a phone | Rings full-screen with one "I'm going" button              |
| `/learn`   | Learn           | Students           | Teaches the signal in three steps, with webcam practice    |
| `/`        | Home            | Everyone           | What Ishaara is and links to the four surfaces             |

## Run it locally

You need Node 22.13 or newer and pnpm 10.

```sh
pnpm install
cp .env.example .env
pnpm dev
```

Open http://localhost:5173. The server runs on port 3001 and the web app proxies `/api` and `/socket.io` to it.

To run the production build the way it is deployed, as one service:

```sh
pnpm build
pnpm start
```

Then open http://localhost:3001.

## Checks

```sh
pnpm lint        # ESLint and Prettier
pnpm typecheck   # TypeScript, strict
pnpm test        # Vitest
pnpm check       # all three
```

CI runs the same checks and a build on every push to `main`.

## Project layout

```
apps/web          Vite, React, Tailwind CSS: the five surfaces
apps/server       Express and Socket.io: alert API and escalation engine
packages/gesture  Pure TypeScript gesture detection, with tests
docs              Architecture notes and the demo script
```

## Settings

All settings are environment variables, documented in [.env.example](.env.example). `DEMO_MODE=true` shortens the timers for presentations.

## Privacy

- Video is analysed on the camera's own device. Frames stay in memory and are discarded.
- The only image that leaves the device is one snapshot, at the moment a signal is confirmed.
- The model finds hand points only. It never identifies who anyone is.
- Police are never called automatically. A guard checks in first, and a person decides.
