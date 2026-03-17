# Airport Now

Airport Now is a traveler-facing web app for checking one departure airport quickly before leaving for the terminal. It pulls together checkpoint pressure, live flight boards, nearby air traffic, route-level delay risk, and short-lived community reports in a single view.

## Live Website

- Production: [https://airport-now.vercel.app](https://airport-now.vercel.app)

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

## Official Wait-Source Survey

Last reviewed on `2026-03-17`.

This repository currently tracks `46` launch airports from `shared/airport-status.ts`. For checkpoint data, the working labels below are what matter during implementation:

- `Wired`: Airport Now already ingests an official airport checkpoint source today.
- `Official estimate only`: the airport publishes a current official estimate, but not a stronger direct live checkpoint feed.
- `Reachable live candidate`: an official live source appears reachable from a backend fetch without private credentials, a browser-only challenge, or a session gate.
- `Live page, gated or blocked`: the official airport site shows live data, but the backing request currently needs a key, cookie/session, or bot mitigation.
- `Advisory or historical only`: the official airport site publishes checkpoint hours, averages, historical ranges, or general guidance instead of a usable real-time queue feed.
- `No usable live source confirmed`: a current official live wait source was not confirmed during this review.

Current rollout picture:

- `30` airports are wired today: `ATL`, `BNA`, `BWI`, `CHS`, `CLE`, `CLT`, `CMH`, `CVG`, `DCA`, `DEN`, `DFW`, `DTW`, `EWR`, `HOU`, `IAD`, `IAH`, `JAX`, `JFK`, `LAX`, `MCO`, `MIA`, `MSP`, `OMA`, `PDX`, `PHL`, `PHX`, `PIT`, `SAT`, `SLC`, `STL`
- `24` of those airports have direct official live wait feeds
- `6` airports currently ship as `official estimate` sources: `CHS`, `CMH`, `JAX`, `OMA`, `SAT`, `STL`

| Airport | Airport Now | Official source state | Source and developer note |
| --- | --- | --- | --- |
| `ATL` | Wired | Open official source | [Official page](https://dev.atl.com/atlsync/security-wait-times/) is already ingested. |
| `ABQ` | FAA/community only | No usable live source confirmed | [Official site](https://www.abqsunport.com/) currently surfaced security guidance, but no live wait feed was confirmed. |
| `AUS` | FAA/community only | No usable live source confirmed | [Official site](https://www.austintexas.gov/airport) did not expose a stable live checkpoint source during this review. |
| `BNA` | Wired | Open official source | [Official site](https://flynashville.com/) renders the live TSA wait card directly in the homepage HTML, and Airport Now now ingests it. |
| `BOS` | FAA/community only | Advisory or historical only | [Official site](https://www.massport.com/logan-airport) advises travelers to monitor checkpoint lines, but no usable live feed was confirmed. |
| `BWI` | Wired | Open official source | [Official site](https://bwiairport.com/) homepage widget is already ingested. |
| `CLE` | Wired | Open official source | [Open JSON](https://www.clevelandairport.com/tsa-wait-times-api) is now ingested. |
| `CLT` | Wired | Open official source | [Official security page](https://www.cltairport.com/airport-info/security/) is already ingested. |
| `CHS` | Wired | Official estimate only | [Official security page](https://iflychs.com/passengers/security-checkpoint/) publishes current checkpoint estimates plus an hourly forecast, so Airport Now ingests it as an official estimate rather than a direct live checkpoint feed. |
| `CMH` | Wired | Official estimate only | [Official security page](https://flycolumbus.com/passengers/security/) publishes a current airport-wide checkpoint estimate plus a same-day forecast, so Airport Now ingests it as an official estimate rather than a direct live checkpoint feed. |
| `CVG` | Wired | Open official source | [Official security page](https://www.cvgairport.com/security/) uses a live airport API, and Airport Now now ingests it with the public page-backed headers. |
| `DCA` | Wired | Open official source | [Official wait-times page](https://www.flyreagan.com/security-wait-times) is already ingested. |
| `DEN` | Wired | Open official source | [Official security page](https://www.flydenver.com/security/) is already ingested. |
| `DFW` | Wired | Open official source | [Official security page](https://www.dfwairport.com/security/) is already ingested. |
| `DTW` | Wired | Open official source | [Open JSON](https://proxy.metroairport.com/SkyFiiTSAProxy.ashx) is now ingested. |
| `EWR` | Wired | Open official source | [Official live page](https://www.newarkairport.com/) uses a live security API, and Airport Now now ingests it with the public site referer. |
| `FLL` | FAA/community only | Advisory or historical only | [Official security page](https://www.broward.org/Airport/Passengers/Services/Pages/Security.aspx) currently provides checkpoint guidance and hours rather than a live feed. |
| `HOU` | Wired | Open official source | [Official security page](https://www.fly2houston.com/hou/security/) uses a live airport API, and Airport Now now ingests it with the public page-backed headers. |
| `IAD` | Wired | Open official source | [Official wait-times page](https://www.flydulles.com/security-wait-times) is already ingested. |
| `IAH` | Wired | Open official source | [Official security page](https://www.fly2houston.com/iah/security/) uses a live airport API, and Airport Now now ingests it with the public page-backed headers. |
| `IND` | FAA/community only | Advisory or historical only | [Official security page](https://www.ind.com/travel-prep/security) currently provides checkpoint hours and TSA guidance only. |
| `JAX` | Wired | Official estimate only | [Official wait page](https://flyjacksonville.com/jaa/content.aspx?id=3583) publishes current lane-level checkpoint estimates, so Airport Now ingests it as an official estimate rather than a direct live checkpoint feed. |
| `JFK` | Wired | Open official source | [Official live page](https://www.jfkairport.com/) and [the public GraphQL endpoint](https://api.jfkairport.com/graphql) are now ingested. |
| `LAS` | FAA/community only | Advisory or historical only | [Official site](https://harryreidairport.com/) announced a real-time wait system, but a current public website feed was not confirmed in this review. |
| `LAX` | Wired | Open official source | [Official wait-times page](https://www.flylax.com/wait-times) is already ingested. |
| `MCI` | FAA/community only | Advisory or historical only | [Official security page](https://flykc.com/security) currently focuses on security process guidance rather than live wait data. |
| `MCO` | Wired | Open official source | [Official site](https://flymco.com/) uses a live checkpoint API, and Airport Now now ingests it with the public page-backed headers. |
| `MDW` | FAA/community only | Advisory or historical only | [Official site](https://www.flychicago.com/midway/home/pages/default.aspx) exposes TSA reports and security guidance, not a live queue feed. |
| `MIA` | Wired | Open official source | [Official wait-times page](https://www.miami-airport.com/tsa-waittimes.asp) is already ingested. |
| `MSP` | Wired | Open official source | [Official wait-times page](https://www.mspairport.com/airport/security-screening/security-wait-times) is already ingested. |
| `OAK` | FAA/community only | Advisory or historical only | [Official security page](https://www.iflyoak.com/business/airport-security/) currently points travelers to security guidance rather than a live airport feed. |
| `OMA` | Wired | Official estimate only | [Official security checkpoint page](https://www.flyoma.com/passenger-services/security-checkpoint-wait-times/) publishes current concourse-level ranges, so Airport Now ingests it as an official estimate rather than a direct live checkpoint feed. |
| `ORD` | FAA/community only | Advisory or historical only | [Official site](https://www.flychicago.com/ohare/home/pages/default.aspx) exposes TSA reports and security guidance, not a live queue feed. |
| `PDX` | Wired | Open official source | [Open JSON](https://www.pdx.com/TSAWaitTimesRefresh) is already ingested. |
| `PHL` | Wired | Open official source | [Official checkpoint page](https://www.phl.org/flights/security-information/checkpoint-hours) configures a live metrics API in its public page script, and Airport Now now ingests it. |
| `PHX` | Wired | Open official source | [Open endpoint](https://api.phx.aero/avn-wait-times/raw?Key=4f85fe2ef5a240d59809b63de94ef536) is already ingested. |
| `PIT` | Wired | Open official source | [Official security page](https://flypittsburgh.com/pittsburgh-international-airport/security/) exposes the official wait API endpoint and its page-backed subscription key, and Airport Now now ingests it at runtime. |
| `RDU` | FAA/community only | Advisory or historical only | [Official wait-times page](https://www.rdu.com/travel-info/wait-times/) currently gives broad guidance instead of live checkpoint data. |
| `SAN` | FAA/community only | Advisory or historical only | [Official security page](https://www.san.org/security-checkpoints-and-tsa-information/) currently focuses on checkpoints and procedures, not live wait times. |
| `SAT` | Wired | Official estimate only | [Official security page](https://flysanantonio.com/home/flights/security-checkpoints-wait-time/) publishes terminal-level security average wait times, so Airport Now ingests it as an official estimate rather than a direct live checkpoint feed. |
| `SEA` | FAA/community only | Advisory or historical only | [Official wait-times page](https://www.flysea.org/page/live-estimated-checkpoint-wait-times) currently says live estimates are being restored. |
| `SFO` | FAA/community only | Advisory or historical only | [Official security page](https://www.flysfo.com/passengers/flight-info/check-in-security) focuses on routing and checkpoint guidance rather than live per-checkpoint waits. |
| `SJC` | FAA/community only | Advisory or historical only | [Official security page](https://www.flysanjose.com/security/security-checkpoints) publishes average wait-time reporting, not real-time checkpoint data. |
| `SLC` | Wired | Open official source | [Open endpoint](https://slcairport.com/ajaxtsa/waittimes) is now ingested. |
| `STL` | Wired | Official estimate only | [Official security page](https://www.flystl.com/tsa-security/) publishes a current on-page checkpoint estimate and checkpoint status cards, so Airport Now ingests it as an official estimate rather than a direct live feed. |
| `TPA` | FAA/community only | Advisory or historical only | [Official security page](https://app.tampaairport.com/security/index.asp) currently gives arrival guidance and security tips rather than live wait data. |

## Product Docs

- [`docs/PRD.md`](./docs/PRD.md)
- [`docs/LIVE_SOURCES.md`](./docs/LIVE_SOURCES.md)
- [`docs/FLIGHT_TRAFFIC_SOURCES.md`](./docs/FLIGHT_TRAFFIC_SOURCES.md)
