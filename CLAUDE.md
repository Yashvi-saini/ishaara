# Ishaara: working notes for Claude

Ishaara lets a woman ask for help silently with the international Signal for Help: palm open with the thumb tucked in, then the fingers fold down over the thumb. A camera recognises the gesture and alerts campus security, which keeps ringing guards until one confirms they are responding.

This is the shortlisting MVP for HerHack 2026 (Student Innovation track, Women Safety award). A reliable end-to-end demo and a professional UI matter more than extra features. If something takes too long, simplify it; never leave it half-finished.

## Commands

| Task                            | Command                                  |
| ------------------------------- | ---------------------------------------- |
| Install                         | `pnpm install`                           |
| Run server and web app together | `pnpm dev` (web on 5173, server on 3001) |
| Lint and format check           | `pnpm lint`                              |
| Fix formatting                  | `pnpm format`                            |
| Typecheck                       | `pnpm typecheck`                         |
| Tests                           | `pnpm test`                              |
| All three checks                | `pnpm check`                             |
| Production build, then run it   | `pnpm build` then `pnpm start`           |
| Tests for one package           | `pnpm --filter @ishaara/gesture test`    |

## Layout

```
apps/web/src/      routes/, components/ui/, components/<surface>/, lib/, workers/, styles/
apps/server/src/   index.ts, app.ts, config.ts, types.ts, routes/, sockets/, services/escalation.ts, store/, seed/
packages/gesture/  src/, tests/fixtures/
docs/              architecture.md, demo-script.md
```

- `apps/web`: Vite, React, TypeScript, Tailwind CSS 4, React Router 7, lucide-react.
- `apps/server`: Node, Express 5, Socket.io. In production it also serves `apps/web/dist`, so there is one Render web service.
- `packages/gesture`: pure TypeScript gesture logic with Vitest tests, used by `/eye` and `/learn`.
- Types shared with the web app live in `apps/server/src/types.ts`. The web app imports them as types only (`import type … from "@ishaara/server/types"`), so that file must have no imports and no runtime code.
- Server code uses NodeNext modules: relative imports need the `.js` extension. Web and gesture code use bundler resolution with no extension.
- Data is an in-memory store loaded from a seed JSON file. No database. Keep the last 50 alerts and their snapshots.
- All dependency versions are pinned exactly (`.npmrc` has `save-exact=true`). TypeScript stays on 6.0.x until typescript-eslint supports 7. React Router stays on 7.x because 8 needs a newer Node than the team has installed.

## Surfaces

1. `/eye`, Ishaara Eye: camera page. MediaPipe runs in a Web Worker, detects the two-step gesture, and sends one snapshot plus the camera ID. No video is recorded or uploaded. No face recognition. Has a "Show tracking" toggle, a status line ("Watching", "Step 1 seen", "Signal sent"), and in demo mode a "Simulate signal" control (also Shift+S).
2. `/command`, Ishaara Command: security dashboard. SVG campus map with camera pins, live alert card with snapshot and location, ring timeline, responder name with a running timer. Actions: Call 112 (`tel:112`), Resolve, Mark false alarm.
3. `/guard`, Guard app: mobile-first. Pick a guard name, tap "Start shift" (unlocks audio), then a full-screen alert with a ring sound and one "I'm going" button.
4. `/learn`, Learn: the signal in 3 illustrated steps, with a webcam practice mode that shows "Recognised".
5. `/`, Home: two sentences on what Ishaara is, how it works in 3 steps, links to the four surfaces. Clean and serious, not a marketing page.

## Gesture detection (packages/gesture)

MediaPipe landmarks: 0 wrist, 4 thumb tip, 8/12/16/20 fingertips, 6/10/14/18 middle joints, 9 middle-finger base, 13 ring-finger base.

- `size = dist(p0, p9)`. Every threshold is relative to size.
- A finger is open if its tip is farther from the wrist than its middle joint, curled if closer.
- Thumb tucked: `dist(p4, p13) < 0.5 * size`. The threshold lives in a config object because it will be tuned.
- Shape A: four fingers open and thumb tucked. Shape B: four fingers curled and thumb tucked.
- State machine, one per hand: Shape A held 5 frames, then Shape B held 5 frames within 2000 ms, emits `signal`. Then a cooldown per camera: 30 s, or 5 s in demo mode.
- API: `createSignalDetector(config)` with `update(hands, timestamp)` returning events.
- Tests with landmark fixtures: valid signal, normal fist with the thumb outside (must not trigger), open palm only, timeout, cooldown.
- HandLandmarker settings: `runningMode: "VIDEO"`, `numHands: 2`, in a Web Worker.
- Mirror only the on-screen preview, never the frame given to MediaPipe.

## Server and escalation

- REST: `POST /api/alerts` (snapshot as a JPEG data URL plus `cameraId`), `GET /api/state`.
- Socket.io events: `alert:new`, `alert:update`, `guard:ring`, `guard:ack`, `alert:resolve`.
- Escalation engine: ring guards one at a time through the Guard app, nearest to the camera first (from seed data), 20 s each, or 8 s in demo mode. The first "I'm going" wins: stop ringing and set the alert to "responding" with the guard's name. If nobody confirms, repeat the chain and keep the dashboard alarm on.
- Never call 112 automatically. The signal means "reach out to me safely"; a person decides.
- The engine is an injectable service with a fake clock in tests.
- Seed: 6 cameras (Main gate, Library, Girls' hostel entrance, Parking, Academic block, Canteen) with map coordinates, and 3 guards with names and zones.
- `DEMO_MODE=true` shortens timers and enables the simulate control.

## UI rules

It must look like a serious control-room tool, not a flashy AI demo.

Never use: neon colours, glows, gradients, glassmorphism, blurred blobs, animated backgrounds, pill-shaped chips, tag clouds, sparkle icons, emoji, all-caps labels, oversized hero text, heavy shadows, lorem ipsum.

Use:

- Neutral palette: white or very light grey surfaces, grey 1px borders, near-black text, one deep blue accent for primary actions and focus.
- Colour for meaning only: red is an active alert, amber is ringing, green is responding or resolved. Status is text plus a small dot or a left border, never a chip.
- IBM Plex Sans with a system fallback, a clear type scale, sentence case, tabular numbers for timers.
- 8px spacing grid, 6px radius, generous whitespace, aligned layouts.
- lucide icons at 16 to 20px, sparingly, always with a text label.
- Motion only with purpose: one brief flash when an alert arrives, a subtle pulse while ringing. Respect `prefers-reduced-motion`.
- WCAG AA contrast, visible keyboard focus, labelled controls.
- Command is desktop-first. Guard and Learn are mobile-first.
- Real empty, loading and error states in plain words, such as "No active alerts. 6 cameras online."
- All colours are CSS variables. UI primitives live in `apps/web/src/components/ui` (Button, Card, Dialog, StatusDot, PageHeader, EmptyState) and are reused everywhere.

## Git

- Remote `origin` is `https://github.com/Yashvi-saini/ishaara.git`, branch `main`.
- Small commits with Conventional Commit messages. Several small commits per phase, never one large one.
- Do not add a `Co-Authored-By` line or any other AI attribution to commits.
- Run `pnpm check` before every push. Never push failing code.
- Push at the end of every phase, then summarise what was built, how to run it, and the decisions made.
- Never commit secrets. Keep `.env.example` documented.

## Code style

- No comments or JSDoc in source code. Use clear names; put explanations in `README.md` and `docs/`.
- The campus map, cameras and guards live in `apps/server/src/seed/campus.json`.
- The app is a PWA: `apps/web/public/manifest.webmanifest`, `apps/web/public/sw.js`, icons in `apps/web/public/icons`. Bump `VERSION` in `sw.js` when its caching rules change. Never cache `/api` or `/socket.io`.

## Phases

0. Initialise: workspace, tooling, CI, docs skeleton.
1. Gesture engine with full tests.
2. Server: Express, Socket.io, in-memory store, seed, alert API, escalation engine with tests.
3. Design system and `/eye`.
4. `/command` and `/guard`: the full end-to-end flow.
5. `/learn` and `/`.
6. Polish and deploy to Render as a single web service (`render.yaml`); final README; `docs/demo-script.md`.
7. Twilio voice calls as a second ringing channel, with graceful fallback when the env vars are missing. Done.

All phases are built. The only remaining step is creating the Render service from `render.yaml`.
