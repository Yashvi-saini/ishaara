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
| `packages/gesture` | Shape rules and the per-hand state machine. Pure TypeScript, no DOM. | Skeleton |
| `apps/server`      | Alert API, escalation engine, Socket.io, serves the built web app.   | Skeleton |
| `apps/web`         | The five surfaces: Home, Eye, Command, Guard, Learn.                 | Skeleton |

## Decisions so far

- **One deploy.** The server serves `apps/web/dist` and falls back to `index.html` for page routes, so client-side routes such as `/command` work on refresh.
- **Shared types without a shared package.** The web app imports `apps/server/src/types.ts` as types only. Nothing from the server is bundled into the browser.
- **No database.** Cameras and guards come from a seed JSON file; alerts live in memory. This keeps the demo free of external services that could fail.
- **Settings come from the server.** Demo mode and timer lengths are read from the server at runtime, so one build works in both modes.
- **Fonts are bundled.** IBM Plex Sans ships with the app, so the UI looks the same on venue WiFi or offline.
