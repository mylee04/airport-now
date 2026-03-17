# Live Source Inventory

Verified on `2026-03-17`.

The latest full `46`-airport survey now lives in the README under `Official Wait-Source Survey`. This document stays focused on what is currently wired and what the next implementation tiers look like.

## Shipping now

| Airport | Status | Live source | Ingestion |
| --- | --- | --- | --- |
| `FAA` | Wired | `https://nasstatus.faa.gov/api/airport-status-information` | Official XML feed for ground stops, ground delays, and closures |
| `ATL` | Wired | `https://dev.atl.com/atlsync/security-wait-times/` | HTML parse from official airport wait-times page |
| `BNA` | Wired | `https://flynashville.com/` | HTML parse from the official homepage TSA wait card |
| `DEN` | Wired | `https://www.flydenver.com/security/` | Official airport wait source |
| `MSP` | Wired | `https://www.mspairport.com/airport/security-screening/security-wait-times` | HTML parse from official wait-times page |
| `CLT` | Wired | `https://www.cltairport.com/airport-info/security/` | Official checkpoint API used by the public page |
| `CHS` | Wired (estimate) | `https://iflychs.com/passengers/security-checkpoint/` | HTML parse from the official current checkpoint estimates and hourly forecast |
| `CVG` | Wired | `https://api.cvgairport.mobi/checkpoints/CVG` | Official checkpoint API used by the airport security page with public page-backed headers |
| `DFW` | Wired | `https://www.dfwairport.com/security/` | Official checkpoint API used by the public page |
| `DCA` | Wired | `https://www.flyreagan.com/security-wait-times` | Official JSON endpoint |
| `IAD` | Wired | `https://www.flydulles.com/security-wait-times` | Official JSON endpoint |
| `EWR` | Wired | `https://avi-prod-mpp-webapp-api.azurewebsites.net/api/v1/SecurityWaitTimesPoints/EWR` | Official security API used by the Newark homepage with a public site referer |
| `IAH` | Wired | `https://api.houstonairports.mobi/wait-times/checkpoint/iah` | Official airport wait API used by the public security page with public page-backed headers |
| `HOU` | Wired | `https://api.houstonairports.mobi/wait-times/checkpoint/hou` | Official airport wait API used by the Hobby security page with public page-backed headers |
| `LAX` | Wired | `https://www.flylax.com/wait-times` | HTML parse from official wait table |
| `MCO` | Wired | `https://api.goaa.aero/wait-times/checkpoint/MCO` | Official airport wait API used by the Orlando homepage with public page-backed headers |
| `BWI` | Wired | `https://bwiairport.com/` | HTML parse from official homepage security widget |
| `MIA` | Wired | `https://www.miami-airport.com/tsa-waittimes.asp` | Official page-backed queue API used by the public wait-times page |
| `CLE` | Wired | `https://www.clevelandairport.com/tsa-wait-times-api` | Open official checkpoint-level feed with qualitative lane levels |
| `CMH` | Wired (estimate) | `https://flycolumbus.com/passengers/security/` | HTML parse from the official current airport-wide checkpoint estimate and same-day forecast |
| `DTW` | Wired | `https://proxy.metroairport.com/SkyFiiTSAProxy.ashx` | Open official JSON endpoint |
| `JAX` | Wired (estimate) | `https://flyjacksonville.com/jaa/content.aspx?id=3583` | HTML parse from the official lane-level checkpoint estimate page |
| `JFK` | Wired | `https://api.jfkairport.com/graphql` | Public GraphQL endpoint used by the airport homepage |
| `OMA` | Wired (estimate) | `https://www.flyoma.com/passenger-services/security-checkpoint-wait-times/` | HTML parse from the official concourse-level checkpoint range page |
| `PHX` | Wired | `https://api.phx.aero/avn-wait-times/raw?Key=4f85fe2ef5a240d59809b63de94ef536` | Open official endpoint |
| `PDX` | Wired | `https://www.pdx.com/TSAWaitTimesRefresh` | Open official JSON endpoint |
| `PHL` | Wired | `https://www.phl.org/flights/security-information/checkpoint-hours` | Official checkpoint metrics API discovered from the public page script |
| `PIT` | Wired | `https://flypittsburgh.com/pittsburgh-international-airport/security/` | Official page-backed API with endpoint and subscription key exposed in the public page script |
| `SAT` | Wired (estimate) | `https://flysanantonio.com/home/flights/security-checkpoints-wait-time/` | HTML parse from the official terminal-level average wait display |
| `SLC` | Wired | `https://slcairport.com/ajaxtsa/waittimes` | Open official JSON endpoint |
| `STL` | Wired (estimate) | `https://www.flystl.com/tsa-security/` | HTML parse from the official on-page checkpoint estimate and checkpoint status cards |

## Tracked with FAA only right now

These airports are live on the board through FAA operational status, but do not yet have a direct queue feed wired into the product:

- `ABQ`
- `AUS`
- `BOS`
- `FLL`
- `IND`
- `LAS`
- `MCI`
- `MDW`
- `OAK`
- `ORD`
- `RDU`
- `SAN`
- `SEA`
- `SFO`
- `SJC`
- `TPA`

## Research notes

- `CVG`, `EWR`, `IAH`, `MCO`, `PHL`: the previously gated sources are now wired through their official page-backed APIs or public page scripts.
- `HOU`: now ships from the same Houston Airports API family as `IAH`, using the public Hobby security page referer and headers.
- `JAX`: now ships as an `official_estimate` source because the airport publishes current lane-level estimates directly on its official wait page.
- `OMA`: now ships as an `official_estimate` source because the airport publishes current concourse-level checkpoint ranges on its official security page.
- `SAT`: now ships as an `official_estimate` source because the airport publishes terminal-level security average wait times on its official page.
- `CHS`: now ships as an `official_estimate` source because the airport publishes current checkpoint estimates plus an hourly forecast on its official security page.
- `CMH`: now ships as an `official_estimate` source because the airport publishes a current airport-wide checkpoint estimate and same-day forecast on its official security page.
- `STL`: now ships as an `official_estimate` source because the airport publishes a current on-page estimate, but not a stronger direct live checkpoint feed.
- `SEA`: official checkpoint page currently says live estimated wait times are being restored, so the airport has guidance but not a usable live queue feed right now.
- `SFO`: official security page exposes checkpoint hours and routing guidance, but not a live per-checkpoint wait feed.
- `AUS`: official public guidance points to a TSA/iinside wait page, but a stable machine-readable source was not confirmed yet.

## Product rule

- `official`: direct airport wait source
- `official_estimate`: current airport-published estimate without a stronger direct live checkpoint feed
- `community`: traveler-submitted queue signal
- `none`: no direct queue feed yet, FAA/seasonality only
