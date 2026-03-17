# Live Source Inventory

Verified on `2026-03-16`.

## Shipping now

| Airport | Status | Live source | Ingestion |
| --- | --- | --- | --- |
| `FAA` | Wired | `https://nasstatus.faa.gov/api/airport-status-information` | Official XML feed for ground stops, ground delays, and closures |
| `MSP` | Wired | `https://www.mspairport.com/airport/security-screening/security-wait-times` | HTML parse from official wait-times page |
| `CLT` | Wired | `https://www.cltairport.com/airport-info/security/` | Official checkpoint API used by the public page |
| `DFW` | Wired | `https://www.dfwairport.com/security/` | Official checkpoint API used by the public page |
| `DCA` | Wired | `https://www.flyreagan.com/security-wait-times` | Official JSON endpoint |
| `IAD` | Wired | `https://www.flydulles.com/security-wait-times` | Official JSON endpoint |
| `LAX` | Wired | `https://www.flylax.com/wait-times` | HTML parse from official wait table |
| `BWI` | Wired | `https://bwiairport.com/` | HTML parse from official homepage security widget |
| `MIA` | Wired | `https://www.miami-airport.com/tsa-waittimes.asp` | Official page-backed queue API used by the public wait-times page |

## Tracked with FAA only right now

These airports are live on the board through FAA operational status, but do not yet have a direct queue feed wired into the product:

- `ATL`
- `AUS`
- `BNA`
- `BOS`
- `DEN`
- `DTW`
- `EWR`
- `FLL`
- `IAH`
- `JFK`
- `LAS`
- `MCO`
- `ORD`
- `PHL`
- `PHX`
- `SAN`
- `SEA`
- `SFO`
- `SLC`
- `TPA`

## Research notes

- `SEA`: official checkpoint page currently says live estimated wait times are being restored, so the airport has guidance but not a usable live queue feed right now.
- `SFO`: official security page exposes checkpoint hours and routing guidance, but not a live per-checkpoint wait feed.
- `AUS`: official public guidance points to a TSA/iinside wait page, but a stable machine-readable source was not confirmed yet.
- `DEN`: official page exists, but terminal fetches were blocked during implementation by anti-bot protection.

## Product rule

- `official`: direct airport wait source
- `community`: traveler-submitted queue signal
- `none`: no direct queue feed yet, FAA/seasonality only
