# Airport Now PRD

## Overview

Airport Now is a web product for monitoring airport security line congestion and flight disruption risk across major U.S. airports. The MVP combines official airport wait-time sources, FAA operational status, and user-submitted field reports into a single traveler-facing dashboard.

## Problem

Travelers can usually find pieces of the story:

- airport wait times on isolated airport pages
- air traffic delays on FAA tools
- anecdotal queue photos on social media

They cannot quickly answer the questions that matter:

- How bad is this airport right now?
- How early should I leave?
- Is my flight likely to be delayed or canceled?
- Is the data trustworthy or stale?

## Target User

- Domestic U.S. travelers leaving from large airports
- Frequent flyers who want a fast airport status scan
- Travelers during peak periods such as holidays, storms, or major events

## MVP Scope

### Airports

- ATL
- LAX
- DEN
- DFW
- CLT
- MSP
- MIA
- SFO

### Core Features

- Airport dashboard with eight major airports
- Security wait-time and crowd-level cards
- Delay Risk and Cancel Risk scores
- Confidence indicator per airport
- Airport detail view with checkpoint status and recent reports
- User reports with optional photo upload
- Narrative operational insight explaining why an airport is stressed

## Product Principles

- Fast scan first, detail second
- Official data wins when available
- Community data fills gaps but does not replace official sources
- Risk scores must be probabilistic, not framed as certainty
- Photos are evidence, not the primary source of truth

## User Stories

- As a traveler, I want to compare multiple airports in under 10 seconds.
- As a departing passenger, I want to know if the security line is likely manageable or severe.
- As a flyer, I want a plain-language delay risk score for my trip.
- As a user on site, I want to submit a report in under 10 seconds.
- As a user, I want to know how fresh and trustworthy the displayed information is.

## Main Screens

### Home Dashboard

Each airport card should show:

- airport code and name
- current wait-time estimate
- crowd level: Low, Medium, High, Severe
- Delay Risk: 0-100%
- Cancel Risk: 0-100%
- Confidence: High, Medium, Low
- freshness timestamp
- report count and photo count

### Airport Detail

- overall crowd summary
- checkpoint status list
- recent wait-time trend
- recent community reports
- recent photos
- operational insight summary
- travel recommendation such as buffer time

### Flight Risk Lookup

- flight number or route input
- Delay Risk and Cancel Risk output
- factors behind the score
- airport contribution
- weather contribution
- FAA contribution

## Data Sources

### Primary

- official airport security wait-time pages
- TSA MyTSA
- FAA NAS Status
- FAA airport status XML feed
- airport flight status pages where available

### Secondary

- TSA passenger volume data
- weather and aviation weather feeds
- user reports and photos

## Scoring Model

### Wait Time

- Use official airport value if available
- Fall back to structured estimate when unavailable

### Crowd Level

Inputs:

- current wait time
- checkpoint closures
- recent acceleration in wait time
- user report volume
- photo freshness

Output:

- Low
- Medium
- High
- Severe

### Delay Risk

Inputs:

- FAA airport delay events
- weather severity
- route and time context
- airport crowd score
- recent historical disruption pattern

Output:

- 0-100% probability-style score

### Cancel Risk

Inputs:

- severe weather
- airport ground stop or closure risk
- cascading delay intensity
- route sensitivity

Output:

- 0-100% probability-style score

### Confidence

Inputs:

- source freshness
- official vs community ratio
- source agreement
- recent ingestion success

Output:

- High
- Medium
- Low

## Community Reports

### Required Fields

- checkpoint or terminal area
- line estimate bucket
- crowd density bucket

### Optional Fields

- one photo
- one short note

### Design Goal

- report submission should take 10 seconds or less

## Photo Policy

- faces blurred automatically
- IDs, boarding passes, passports, and sensitive screens blocked when detected
- exact GPS not shown to other users
- photos expire from the live feed after a short window
- users see relative location labels such as North Checkpoint

## Non-Goals

- direct display of TSA staffing headcount
- exact minute-by-minute guarantee for queue length
- nationwide coverage in the first release
- always-on interior terminal livestreams

## MVP Success Metrics

- median dashboard scan time under 15 seconds
- source freshness under 5 minutes for most cards
- meaningful repeat usage during travel days
- report submission completion rate above 50%
- risk score calibration improves over time

## Release Phases

### Phase 1

- dashboard
- airport detail
- manual data mocks and adapters

### Phase 2

- live ingestion from selected airport sources
- user reports and photos

### Phase 3

- flight lookup
- Delay Risk and Cancel Risk scoring
- explainability layer
