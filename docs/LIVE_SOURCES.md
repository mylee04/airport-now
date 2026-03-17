# Live Source Inventory

Verified on `2026-03-17`.

The latest full `41`-airport survey now lives in the README under `Official Wait-Source Survey`. This document stays focused on what is currently wired and what the next implementation tiers look like.

## Shipping now

| Airport | Status | Live source | Ingestion |
| --- | --- | --- | --- |
| `FAA` | Wired | `https://nasstatus.faa.gov/api/airport-status-information` | Official XML feed for ground stops, ground delays, and closures |
| `ATL` | Wired | `https://dev.atl.com/atlsync/security-wait-times/` | HTML parse from official airport wait-times page |
| `DEN` | Wired | `https://www.flydenver.com/security/` | Official airport wait source |
| `MSP` | Wired | `https://www.mspairport.com/airport/security-screening/security-wait-times` | HTML parse from official wait-times page |
| `CLT` | Wired | `https://www.cltairport.com/airport-info/security/` | Official checkpoint API used by the public page |
| `DFW` | Wired | `https://www.dfwairport.com/security/` | Official checkpoint API used by the public page |
| `DCA` | Wired | `https://www.flyreagan.com/security-wait-times` | Official JSON endpoint |
| `IAD` | Wired | `https://www.flydulles.com/security-wait-times` | Official JSON endpoint |
| `LAX` | Wired | `https://www.flylax.com/wait-times` | HTML parse from official wait table |
| `BWI` | Wired | `https://bwiairport.com/` | HTML parse from official homepage security widget |
| `MIA` | Wired | `https://www.miami-airport.com/tsa-waittimes.asp` | Official page-backed queue API used by the public wait-times page |
| `CLE` | Wired | `https://www.clevelandairport.com/tsa-wait-times-api` | Open official checkpoint-level feed with qualitative lane levels |
| `DTW` | Wired | `https://proxy.metroairport.com/SkyFiiTSAProxy.ashx` | Open official JSON endpoint |
| `JFK` | Wired | `https://api.jfkairport.com/graphql` | Public GraphQL endpoint used by the airport homepage |
| `PHX` | Wired | `https://api.phx.aero/avn-wait-times/raw?Key=4f85fe2ef5a240d59809b63de94ef536` | Open official endpoint |
| `PDX` | Wired | `https://www.pdx.com/TSAWaitTimesRefresh` | Open official JSON endpoint |
| `SLC` | Wired | `https://slcairport.com/ajaxtsa/waittimes` | Open official JSON endpoint |

## Tracked with FAA only right now

These airports are live on the board through FAA operational status, but do not yet have a direct queue feed wired into the product:

- `ABQ`
- `AUS`
- `BNA`
- `BOS`
- `CMH`
- `CVG`
- `EWR`
- `FLL`
- `IAH`
- `IND`
- `LAS`
- `MCI`
- `MCO`
- `MDW`
- `OAK`
- `ORD`
- `PHL`
- `PIT`
- `RDU`
- `SAN`
- `SEA`
- `SFO`
- `SJC`
- `STL`
- `TPA`

## Research notes

- `EWR`, `IAH`, `MCO`, `PHL`, `PIT`, `CVG`, `BNA`: live data exists on the official sites, but current backend fetches still run into auth, session, or bot-protection gates.
- `SEA`: official checkpoint page currently says live estimated wait times are being restored, so the airport has guidance but not a usable live queue feed right now.
- `SFO`: official security page exposes checkpoint hours and routing guidance, but not a live per-checkpoint wait feed.
- `AUS`: official public guidance points to a TSA/iinside wait page, but a stable machine-readable source was not confirmed yet.

## Product rule

- `official`: direct airport wait source
- `community`: traveler-submitted queue signal
- `none`: no direct queue feed yet, FAA/seasonality only
