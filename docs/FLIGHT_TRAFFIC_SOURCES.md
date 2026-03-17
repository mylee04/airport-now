# Flight Traffic Sources

Verified on `2026-03-16`.

## Public tracker products

- `FlightAware airport pages`
  - Example: `https://www.flightaware.com/live/airport/KATL`
  - Good for live airport boards and public linking
  - Direct iframe embedding is blocked by `X-Frame-Options: SAMEORIGIN`
  - Internal API product is `AeroAPI`, which is commercial

- `Flightradar24 airport pages`
  - Example: `https://www.flightradar24.com/data/airports/atl`
  - Good for public airport boards and outbound links
  - Direct iframe embedding is blocked by `X-Frame-Options: SAMEORIGIN`
  - Full API access is commercial

- `RadarBox airport pages`
  - Example: `https://www.radarbox.com/data/airports/ATL`
  - Good for public airport boards and outbound links
  - Full API access is commercial

## Public API we can use now

- `OpenSky Network states feed`
  - `https://opensky-network.org/api/states/all`
  - Works for current airborne aircraft positions over the U.S.
  - Good for the map layer
  - Not a full airport arrivals/departures board

## What still needs a paid provider

- Exact live arrival and departure boards inside Airport Now
- Flight-number-level delay and cancellation status
- Airline-tail and gate-aware event streams
- Dense airport movement timelines without aggressive rate limits

## Recommended product split

- `Today`: OpenSky map layer + outbound links to public airport tracker pages
- `Next`: paid aviation API for in-app arrivals/departures and richer flight cards
