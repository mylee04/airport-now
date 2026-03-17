# Airport Now

Airport Now is a traveler-facing web app for checking one departure airport quickly before leaving for the terminal. It pulls together checkpoint pressure, live flight boards, nearby air traffic, route-level delay risk, and short-lived community reports in a single view.

## Live Website

- Production: [https://airport-pulse.vercel.app](https://airport-pulse.vercel.app)

## What The Product Does

- Lets travelers pick one departure airport and stay focused on that airport
- Shows official checkpoint data when the airport exposes it
- Renders live departure and arrival board snapshots inside the app
- Models route-level delay and cancellation risk from current airport conditions
- Displays nearby live aircraft activity for the selected airport
- Accepts traveler queue reports with an optional photo
- Auto-expires community reports and photos after 2 hours

## Why This Exists

Airport status is usually fragmented across airport pages, FAA tools, flight trackers, and social posts. Airport Now is designed to answer a simpler question fast:

"What does my airport look like right now, and how risky does my departure feel?"

## Tech Stack

- Frontend: React 19 + Vite + TypeScript
- Backend: Bun + TypeScript
- Deployment: Vercel
- Shared contracts: TypeScript types in `shared/`

## Repository Structure

- `web/`: frontend application
- `backend/`: airport data services, report handling, and API logic
- `api/`: thin Vercel function entrypoints and routing bridge
- `shared/`: shared API types used by both frontend and backend
- `docs/`: PRD, live source notes, and launch planning

## Local Development

### Prerequisites

- Bun

### Install

```bash
bun install
```

### Run

```bash
bun run dev:api
bun run dev:web
```

Default local URLs:

- Web: `http://127.0.0.1:5173` or the Vite port shown in your terminal
- API: `http://localhost:8787`

## Build

```bash
bun run build:web
bun run build:api
```

## Deployment Notes

The app is deployed on Vercel with:

- a static frontend build from `web/dist`
- Bun-powered server functions for `/api/*`

Important current limitation:

- Community reports and uploaded photos are stored in temporary runtime storage on Vercel, not in a database or durable object store.
- That means reports work in production right now, but they are not guaranteed to survive instance recycling or future deployments.

If durable storage becomes necessary later, the next step should be moving report metadata and photo uploads to a persistent store such as Vercel Blob or another external storage service.

## Product Docs

- [`docs/PRD.md`](./docs/PRD.md)
- [`docs/LIVE_SOURCES.md`](./docs/LIVE_SOURCES.md)
- [`docs/FLIGHT_TRAFFIC_SOURCES.md`](./docs/FLIGHT_TRAFFIC_SOURCES.md)
