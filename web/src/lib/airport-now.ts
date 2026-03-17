import {
  AIRPORT_METADATA,
  buildSeedAirportStatuses,
  type AirportCheckpoint,
  type AirportCode,
  type AirportStatus,
} from '../../../shared/airport-status';
import type { FlightRiskApiResponse } from '../../../shared/flight-risk';
import type { FlightBoardEntry, FlightBoardsApiResponse } from '../../../shared/flight-board';
import type { TrafficApiResponse } from '../../../shared/traffic';
import type { AirportReport, ReportCrowdLevel, ReportQueueLength } from '../../../shared/report';

export type LoadMode = 'loading' | 'live' | 'fallback';
export type FlightRiskMode = 'idle' | 'loading' | 'ready' | 'error';
export type ReportLoadMode = 'idle' | 'loading' | 'ready' | 'error';
export type ReportSubmitMode = 'idle' | 'submitting' | 'success' | 'error';
export type TrafficLoadMode = 'loading' | 'live' | 'error';
export type FlightBoardsLoadMode = 'idle' | 'loading' | 'ready' | 'error';
export type BoardTimeFilter = 'upcoming' | 'past' | 'all';
export type BoardSectionKey = 'departures' | 'arrivals';
export type SelectedBoardFocus = {
  entryId: string;
  sectionKey: BoardSectionKey;
};
export type FlightFormState = {
  origin: AirportCode;
  destination: string;
  departureLocalTime: string;
};
export type AirportCoverageTier = 'official' | 'community' | 'advisory' | 'limited';
export type ReportFormState = {
  checkpoint: string;
  queueLength: ReportQueueLength;
  crowdLevel: ReportCrowdLevel;
  note: string;
  photo: File | null;
};
export type FocusTrafficKind = 'approaching' | 'outbound' | 'transit';
export type FocusedTrafficNode = TrafficApiResponse['aircraft'][number] & {
  kind: FocusTrafficKind;
  distanceNm: number;
  altitudeFeet: number | null;
  speedKnots: number | null;
  operatorName: string | null;
  position: { x: number; y: number };
};
export type FocusedTrafficSummary = {
  radiusNm: number;
  aircraft: FocusedTrafficNode[];
  approachingCount: number;
  outboundCount: number;
  transitCount: number;
};
export type TrackerLink = {
  label: string;
  href: string;
};
export type StatusMetric = {
  label: string;
  value: string;
};
export type ConcourseBoardPanelModel = {
  sectionKey: BoardSectionKey;
  title: string;
  timeColumns: [string, string];
  routeLabel: string;
  visibleEntries: FlightBoardEntry[];
  hiddenCount: number;
  count: number;
};
export type FlightRiskData = FlightRiskApiResponse['flightRisk'];

export const fallbackAirports = buildSeedAirportStatuses();
export const AIRPORT_META_BY_CODE = Object.fromEntries(
  AIRPORT_METADATA.map((airport) => [airport.code, airport]),
) as Record<AirportCode, (typeof AIRPORT_METADATA)[number]>;
export const AIRPORT_TIME_ZONES = Object.fromEntries(
  AIRPORT_METADATA.map((airport) => [airport.code, airport.timeZone]),
) as Record<AirportCode, string>;
export const NATIONAL_AIRSPACE_RADIUS_NM = 120;
export const TRAFFIC_REFRESH_INTERVAL_MS = 20_000;
export const TRAFFIC_TICK_INTERVAL_MS = 1_000;
export const MAX_TRAFFIC_EXTRAPOLATION_SECONDS = 24;
export const FOCUSED_TRAFFIC_MIN_RADIUS_NM = 4.5;
export const FOCUSED_TRAFFIC_MAX_RENDERED = 24;
export const FOCUSED_TRAFFIC_RADIUS_FOCUS_QUANTILE = 0.82;
export const FOCUSED_TRAFFIC_DISTANCE_EXPONENT = 0.42;
export const FOCUSED_TRAFFIC_CENTER_BOOST_CUTOFF = 0.42;
export const FOCUSED_TRAFFIC_MIN_VISIBLE_RATIO = 0.18;
export const FOCUSED_TRAFFIC_TANGENTIAL_RATIO = 0.09;
export const FOCUSED_TRAFFIC_ZERO_DISTANCE_RATIO = 0.22;

const AIRLINE_PREFIX_LABELS: Record<string, string> = {
  AAL: 'American Airlines',
  ACA: 'Air Canada',
  AFR: 'Air France',
  ASA: 'Alaska Airlines',
  ASH: 'Mesa Airlines',
  BAW: 'British Airways',
  CKS: 'Kalitta Air',
  DAL: 'Delta Air Lines',
  EDV: 'Endeavor Air',
  ENY: 'Envoy Air',
  ETD: 'Etihad Airways',
  FFT: 'Frontier Airlines',
  FDX: 'FedEx',
  JBU: 'JetBlue',
  JIA: 'PSA Airlines',
  KLM: 'KLM',
  NKS: 'Spirit Airlines',
  PDT: 'Piedmont Airlines',
  QTR: 'Qatar Airways',
  RPA: 'Republic Airways',
  SKW: 'SkyWest Airlines',
  SWA: 'Southwest Airlines',
  TSC: 'Air Transat',
  UAL: 'United Airlines',
  UCA: 'CommuteAir',
  UPS: 'UPS',
  VIR: 'Virgin Atlantic',
  WJA: 'WestJet',
};

const AIRLINE_PREFIX_TO_FLIGHT_CODE: Record<string, string> = {
  AAL: 'AA',
  ACA: 'AC',
  AFR: 'AF',
  ASA: 'AS',
  BAW: 'BA',
  CKS: 'K4',
  DAL: 'DL',
  ETD: 'EY',
  FFT: 'F9',
  FDX: 'FX',
  JBU: 'B6',
  KLM: 'KL',
  NKS: 'NK',
  QTR: 'QR',
  SWA: 'WN',
  TSC: 'TS',
  UAL: 'UA',
  UPS: '5X',
  VIR: 'VS',
  WJA: 'WS',
};

export function formatDateTimeInputForAirport(date: Date, airportCode: AirportCode): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AIRPORT_TIME_ZONES[airportCode],
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = Object.fromEntries(
    parts
      .filter((part) => ['year', 'month', 'day', 'hour', 'minute'].includes(part.type))
      .map((part) => [part.type, part.value]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;

  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

export function getAirportTimeZoneShort(airportCode: AirportCode, date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AIRPORT_TIME_ZONES[airportCode],
    timeZoneName: 'short',
  }).formatToParts(date);

  return parts.find((part) => part.type === 'timeZoneName')?.value ?? AIRPORT_TIME_ZONES[airportCode];
}

export function getDefaultDepartureLocalTime(airportCode: AirportCode): string {
  return formatDateTimeInputForAirport(new Date(), airportCode);
}

export function getSuggestedDestination(origin: AirportCode): string {
  return origin === 'LAX' || origin === 'SFO' ? 'ATL' : 'LAX';
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeHeadingDelta(left: number, right: number): number {
  const delta = Math.abs(left - right) % 360;
  return delta > 180 ? 360 - delta : delta;
}

export function computeDistanceNm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const earthRadiusNm = 3440.065;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const fromLatitudeRadians = toRadians(fromLatitude);
  const toLatitudeRadians = toRadians(toLatitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitudeRadians) * Math.cos(toLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusNm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearingDegrees(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const fromLatitudeRadians = toRadians(fromLatitude);
  const toLatitudeRadians = toRadians(toLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitudeRadians);
  const x =
    Math.cos(fromLatitudeRadians) * Math.sin(toLatitudeRadians) -
    Math.sin(fromLatitudeRadians) * Math.cos(toLatitudeRadians) * Math.cos(longitudeDelta);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function advanceAircraftPosition(
  latitude: number,
  longitude: number,
  heading: number | null,
  velocityMetersPerSecond: number | null,
  elapsedSeconds: number,
): { latitude: number; longitude: number } {
  if (heading === null || velocityMetersPerSecond === null || elapsedSeconds <= 0) {
    return { latitude, longitude };
  }

  const distanceNm = (velocityMetersPerSecond * elapsedSeconds) / 1852;

  if (!Number.isFinite(distanceNm) || distanceNm <= 0) {
    return { latitude, longitude };
  }

  const earthRadiusNm = 3440.065;
  const angularDistance = distanceNm / earthRadiusNm;
  const headingRadians = toRadians(heading);
  const latitudeRadians = toRadians(latitude);
  const longitudeRadians = toRadians(longitude);
  const nextLatitude = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance) +
      Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(headingRadians),
  );
  const nextLongitude =
    longitudeRadians +
    Math.atan2(
      Math.sin(headingRadians) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(nextLatitude),
    );

  return {
    latitude: toDegrees(nextLatitude),
    longitude: ((toDegrees(nextLongitude) + 540) % 360) - 180,
  };
}

export function projectTrafficSnapshotAircraft(
  trafficSnapshot: TrafficApiResponse | null,
  trafficClock: number,
): TrafficApiResponse['aircraft'] {
  if (!trafficSnapshot) {
    return [];
  }

  const generatedAtMs = new Date(trafficSnapshot.generatedAt).getTime();
  const elapsedSeconds = Math.max(
    0,
    Math.min(MAX_TRAFFIC_EXTRAPOLATION_SECONDS, (trafficClock - generatedAtMs) / 1000),
  );

  return trafficSnapshot.aircraft.map((aircraft) => {
    const projected = advanceAircraftPosition(
      aircraft.latitude,
      aircraft.longitude,
      aircraft.heading,
      aircraft.velocityMetersPerSecond,
      elapsedSeconds,
    );

    return {
      ...aircraft,
      latitude: projected.latitude,
      longitude: projected.longitude,
    };
  });
}

export function classifyTrafficKind(
  airportLatitude: number,
  airportLongitude: number,
  aircraftLatitude: number,
  aircraftLongitude: number,
  heading: number | null,
): FocusTrafficKind {
  if (heading === null) {
    return 'transit';
  }

  const inboundBearing = computeBearingDegrees(
    aircraftLatitude,
    aircraftLongitude,
    airportLatitude,
    airportLongitude,
  );
  const outboundBearing = computeBearingDegrees(
    airportLatitude,
    airportLongitude,
    aircraftLatitude,
    aircraftLongitude,
  );
  const inboundDelta = normalizeHeadingDelta(heading, inboundBearing);
  const outboundDelta = normalizeHeadingDelta(heading, outboundBearing);

  if (inboundDelta <= 40) {
    return 'approaching';
  }

  if (outboundDelta <= 40) {
    return 'outbound';
  }

  return 'transit';
}

export function projectFocusedPoint(
  centerLatitude: number,
  centerLongitude: number,
  targetLatitude: number,
  targetLongitude: number,
  radiusNm: number,
  seed: string,
): { x: number; y: number } {
  const deltaLongitudeNm =
    (targetLongitude - centerLongitude) * 60 * Math.cos(toRadians(centerLatitude));
  const deltaLatitudeNm = (targetLatitude - centerLatitude) * 60;
  const distanceNm = Math.hypot(deltaLongitudeNm, deltaLatitudeNm);
  let seedHash = 0;

  for (const character of seed) {
    seedHash = (seedHash * 31 + character.charCodeAt(0)) >>> 0;
  }

  const seedUnit = seedHash / 0xffff_ffff;

  if (distanceNm < 0.08) {
    const angle = seedUnit * Math.PI * 2;
    const ringRatio = FOCUSED_TRAFFIC_ZERO_DISTANCE_RATIO * (0.75 + seedUnit * 0.5);

    return {
      x: Math.min(Math.max(50 + Math.cos(angle) * ringRatio * 50, 0), 100),
      y: Math.min(Math.max(50 - Math.sin(angle) * ringRatio * 50, 0), 100),
    };
  }

  const normalizedDistance = Math.min(distanceNm / radiusNm, 1);
  const centerBoost =
    normalizedDistance < FOCUSED_TRAFFIC_CENTER_BOOST_CUTOFF
      ? FOCUSED_TRAFFIC_MIN_VISIBLE_RATIO * (1 - normalizedDistance / FOCUSED_TRAFFIC_CENTER_BOOST_CUTOFF)
      : 0;
  const expandedDistanceNm =
    (centerBoost + Math.pow(normalizedDistance, FOCUSED_TRAFFIC_DISTANCE_EXPONENT) * (1 - centerBoost)) *
    radiusNm;
  const unitLongitudeNm = deltaLongitudeNm / distanceNm;
  const unitLatitudeNm = deltaLatitudeNm / distanceNm;
  const tangentialStrength = Math.max(0, 1 - normalizedDistance / FOCUSED_TRAFFIC_CENTER_BOOST_CUTOFF);
  const tangentialOffsetNm =
    radiusNm * FOCUSED_TRAFFIC_TANGENTIAL_RATIO * tangentialStrength * (seedUnit * 2 - 1);
  const scaledLongitudeNm =
    unitLongitudeNm * expandedDistanceNm - unitLatitudeNm * tangentialOffsetNm;
  const scaledLatitudeNm =
    unitLatitudeNm * expandedDistanceNm + unitLongitudeNm * tangentialOffsetNm;

  return {
    x: Math.min(Math.max(50 + (scaledLongitudeNm / radiusNm) * 50, 0), 100),
    y: Math.min(Math.max(50 - (scaledLatitudeNm / radiusNm) * 50, 0), 100),
  };
}

export function formatDistanceNm(distanceNm: number): string {
  return `${Math.round(distanceNm)} nm`;
}

export function inferOperatorName(callsign: string | null): string | null {
  if (!callsign) {
    return null;
  }

  const prefix = callsign.toUpperCase().match(/^[A-Z]{3}/)?.[0];
  return prefix ? AIRLINE_PREFIX_LABELS[prefix] ?? null : null;
}

export function formatTrafficKindLabel(kind: FocusTrafficKind): string {
  if (kind === 'approaching') {
    return 'Approaching';
  }

  if (kind === 'outbound') {
    return 'Outbound';
  }

  return 'Transit';
}

export function normalizeBoardFlightCode(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const compact = value.toUpperCase().replace(/\s+/g, '');
  const match = compact.match(/^([A-Z0-9]{2,3})(\d{1,4})/);

  return match ? `${match[1]}${match[2]}` : compact;
}

export function normalizeTrafficFlightCode(callsign: string | null): string | null {
  if (!callsign) {
    return null;
  }

  const compact = callsign.toUpperCase().replace(/\s+/g, '');
  const match = compact.match(/^([A-Z]{3})(\d{1,4})/);

  if (!match) {
    return compact;
  }

  const prefix = AIRLINE_PREFIX_TO_FLIGHT_CODE[match[1]] ?? match[1];
  return `${prefix}${match[2]}`;
}

export function formatRelativeTime(isoDate: string): string {
  const seconds = Math.round((new Date(isoDate).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];

  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size || unit === 'minute') {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }

  return formatter.format(seconds, 'second');
}

export function formatReportLifetime(createdAt: string, expiresAt: string): string {
  return `${formatRelativeTime(createdAt)} · auto-deletes ${formatRelativeTime(expiresAt)}`;
}

export function formatRiskDisplay(value: number): string {
  return value > 0 ? `${value}%` : 'Not available';
}

export function formatWaitSourceLabel(source: AirportStatus['waitTimeSource']): string {
  if (source === 'official') {
    return 'official';
  }

  if (source === 'community') {
    return 'community';
  }

  return 'none';
}

export function formatOpsSourceLabel(source: AirportStatus['riskSource']): string {
  if (source === 'live') {
    return 'FAA live';
  }

  if (source === 'community') {
    return 'community';
  }

  return 'none';
}

export function getAirportCoverageTier(airport: AirportStatus): AirportCoverageTier {
  if (airport.waitTimeSource === 'official') {
    return 'official';
  }

  if (airport.waitTimeSource === 'community') {
    return 'community';
  }

  if (airport.riskSource === 'live') {
    return 'advisory';
  }

  return 'limited';
}

export function formatCoverageTierLabel(tier: AirportCoverageTier): string {
  if (tier === 'official') {
    return 'Official live wait';
  }

  if (tier === 'community') {
    return 'Community-backed wait';
  }

  if (tier === 'advisory') {
    return 'FAA advisory only';
  }

  return 'No live wait feed';
}

export function checkpointTag(checkpoint: AirportCheckpoint): string {
  if (checkpoint.status === 'Closed') {
    return 'checkpoint-tag-closed';
  }

  if (checkpoint.status === 'PreCheck Only') {
    return 'checkpoint-tag-precheck';
  }

  return 'checkpoint-tag-open';
}

export function buildInitialReportForm(airport: AirportStatus): ReportFormState {
  return {
    checkpoint: airport.checkpoints[0]?.name ?? `${airport.code} main checkpoint`,
    queueLength: '10-20 min',
    crowdLevel: 'Normal',
    note: '',
    photo: null,
  };
}

export function buildTrackerLinks(airportCode: AirportCode): TrackerLink[] {
  const airport = AIRPORT_META_BY_CODE[airportCode];

  return [
    {
      label: 'FlightAware live board',
      href: `https://www.flightaware.com/live/airport/${airport.icaoCode}`,
    },
    {
      label: 'Flightradar24 airport board',
      href: `https://www.flightradar24.com/data/airports/${airport.code.toLowerCase()}`,
    },
    {
      label: 'RadarBox airport board',
      href: `https://www.radarbox.com/data/airports/${airport.code}`,
    },
  ];
}

export function formatBoardTime(value: string | null): string {
  return value ?? 'TBD';
}

export function formatBoardRouteLabel(entry: FlightBoardEntry): string {
  const city = entry.counterpartAirportCity ?? entry.counterpartAirportName ?? 'Route pending';
  return entry.counterpartAirportCode ? `${city} (${entry.counterpartAirportCode})` : city;
}

export function getBoardReferenceTime(entry: FlightBoardEntry): number | null {
  return entry.latestTimeEpochMs ?? entry.scheduledTimeEpochMs;
}

function compareBoardEntries(left: FlightBoardEntry, right: FlightBoardEntry, direction: 'asc' | 'desc'): number {
  const leftTime = getBoardReferenceTime(left) ?? 0;
  const rightTime = getBoardReferenceTime(right) ?? 0;
  const delta = leftTime - rightTime;

  return direction === 'asc' ? delta : -delta;
}

export function getBoardEntryCounts(entries: FlightBoardEntry[], now: number): Record<BoardTimeFilter, number> {
  return {
    upcoming: entries.filter((entry) => {
      const referenceTime = getBoardReferenceTime(entry);
      return referenceTime !== null && referenceTime >= now;
    }).length,
    past: entries.filter((entry) => {
      const referenceTime = getBoardReferenceTime(entry);
      return referenceTime !== null && referenceTime < now;
    }).length,
    all: entries.length,
  };
}

export function getFilteredBoardEntries(
  entries: FlightBoardEntry[],
  filter: BoardTimeFilter,
  now: number,
): FlightBoardEntry[] {
  if (filter === 'all') {
    return [...entries].sort((left, right) => compareBoardEntries(left, right, 'asc'));
  }

  if (filter === 'past') {
    return entries
      .filter((entry) => {
        const referenceTime = getBoardReferenceTime(entry);
        return referenceTime !== null && referenceTime < now;
      })
      .sort((left, right) => compareBoardEntries(left, right, 'desc'));
  }

  return entries
    .filter((entry) => {
      const referenceTime = getBoardReferenceTime(entry);
      return referenceTime !== null && referenceTime >= now;
    })
    .sort((left, right) => compareBoardEntries(left, right, 'asc'));
}

export function formatBoardTimeMeta(entry: FlightBoardEntry): string {
  if (entry.latestTimeLocal && entry.latestTimeLocal !== entry.scheduledTimeLocal) {
    const prefix =
      entry.latestTimeKind === 'actual' ? 'Actual' : entry.latestTimeKind === 'estimated' ? 'Est.' : 'Sched.';

    return `${prefix} ${entry.latestTimeLocal}`;
  }

  if (entry.latestTimeKind === 'actual') {
    return 'Actual';
  }

  if (entry.latestTimeKind === 'estimated') {
    return 'Estimated';
  }

  return 'On schedule';
}

export function formatBoardStatusMeta(entry: FlightBoardEntry): string | null {
  if (entry.isCancelled) {
    return 'Removed from active gate flow';
  }

  if (entry.codeshares.length > 0) {
    return `Codeshare ${entry.codeshares[0]}`;
  }

  if (entry.duration) {
    return `Block ${entry.duration}`;
  }

  return null;
}

export function formatBoardDirectionLabel(sectionKey: BoardSectionKey): string {
  return sectionKey === 'departures' ? 'Departure' : 'Arrival';
}

export function formatDenseBoardTime(value: string | null): string {
  return value ?? '--:--';
}

export function formatDenseBoardRoute(entry: FlightBoardEntry): string {
  const label =
    entry.counterpartAirportCity ?? entry.counterpartAirportName ?? entry.counterpartAirportCode ?? 'Route pending';

  return label.toUpperCase();
}

export function formatDenseBoardRemark(entry: FlightBoardEntry): string {
  return entry.statusText.toUpperCase();
}

export function formatAirportClock(timeMs: number, airportCode: AirportCode): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: AIRPORT_TIME_ZONES[airportCode],
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(timeMs);
}

export function findSelectedBoardEntry(
  flightBoards: FlightBoardsApiResponse | null,
  selectedBoardFocus: SelectedBoardFocus | null,
): FlightBoardEntry | null {
  if (!selectedBoardFocus || !flightBoards) {
    return null;
  }

  const sourceEntries =
    selectedBoardFocus.sectionKey === 'departures' ? flightBoards.departures : flightBoards.arrivals;

  return sourceEntries.find((entry) => entry.id === selectedBoardFocus.entryId) ?? null;
}

export function buildFocusedTrafficSummary(
  displayAirportTrafficAircraft: TrafficApiResponse['aircraft'],
  selectedAirportCode: AirportCode,
): FocusedTrafficSummary {
  const selectedAirportMeta = AIRPORT_META_BY_CODE[selectedAirportCode];
  const nearbyAircraft = displayAirportTrafficAircraft
    .map((aircraft) => {
      const distanceNm = computeDistanceNm(
        selectedAirportMeta.latitude,
        selectedAirportMeta.longitude,
        aircraft.latitude,
        aircraft.longitude,
      );

      if (distanceNm > NATIONAL_AIRSPACE_RADIUS_NM) {
        return null;
      }

      return {
        ...aircraft,
        distanceNm,
        altitudeFeet: aircraft.altitudeMeters !== null ? aircraft.altitudeMeters * 3.28084 : null,
        speedKnots:
          aircraft.velocityMetersPerSecond !== null ? aircraft.velocityMetersPerSecond * 1.94384 : null,
        operatorName: inferOperatorName(aircraft.callsign),
        kind: classifyTrafficKind(
          selectedAirportMeta.latitude,
          selectedAirportMeta.longitude,
          aircraft.latitude,
          aircraft.longitude,
          aircraft.heading,
        ),
      };
    })
    .filter((aircraft): aircraft is Omit<FocusedTrafficNode, 'position'> => aircraft !== null)
    .sort((left, right) => left.distanceNm - right.distanceNm)
    .slice(0, FOCUSED_TRAFFIC_MAX_RENDERED);

  const sortedDistances = nearbyAircraft.map((aircraft) => aircraft.distanceNm).sort((left, right) => left - right);
  const focusDistanceNm =
    sortedDistances.length > 0
      ? sortedDistances[Math.max(0, Math.ceil(sortedDistances.length * FOCUSED_TRAFFIC_RADIUS_FOCUS_QUANTILE) - 1)]
      : 18;
  const radiusNm = Math.max(
    FOCUSED_TRAFFIC_MIN_RADIUS_NM,
    Math.min(NATIONAL_AIRSPACE_RADIUS_NM, focusDistanceNm * 1.12),
  );
  const aircraft = nearbyAircraft.map((entry) => ({
    ...entry,
    position: projectFocusedPoint(
      selectedAirportMeta.latitude,
      selectedAirportMeta.longitude,
      entry.latitude,
      entry.longitude,
      radiusNm,
      entry.id,
    ),
  }));

  return {
    radiusNm,
    aircraft,
    approachingCount: aircraft.filter((entry) => entry.kind === 'approaching').length,
    outboundCount: aircraft.filter((entry) => entry.kind === 'outbound').length,
    transitCount: aircraft.filter((entry) => entry.kind === 'transit').length,
  };
}

export function matchAircraftToBoard(
  activeTrafficAircraft: FocusedTrafficNode | null,
  flightBoards: FlightBoardsApiResponse | null,
): { entry: FlightBoardEntry; sectionKey: BoardSectionKey } | null {
  if (!activeTrafficAircraft || !flightBoards) {
    return null;
  }

  const flightCode = normalizeTrafficFlightCode(activeTrafficAircraft.callsign);
  if (!flightCode) {
    return null;
  }

  const searchOrder: BoardSectionKey[] =
    activeTrafficAircraft.kind === 'approaching'
      ? ['arrivals', 'departures']
      : activeTrafficAircraft.kind === 'outbound'
        ? ['departures', 'arrivals']
        : ['arrivals', 'departures'];

  for (const sectionKey of searchOrder) {
    const entries = sectionKey === 'arrivals' ? flightBoards.arrivals : flightBoards.departures;
    const match = entries.find((entry) => {
      const normalizedFlight = normalizeBoardFlightCode(entry.flightNumber);
      const normalizedMarketing = normalizeBoardFlightCode(entry.marketingFlightNumber);
      const normalizedCodeshares = entry.codeshares.map((codeshare) => normalizeBoardFlightCode(codeshare));

      return (
        normalizedFlight === flightCode ||
        normalizedMarketing === flightCode ||
        normalizedCodeshares.includes(flightCode)
      );
    });

    if (match) {
      return { entry: match, sectionKey };
    }
  }

  return null;
}

export function buildConcourseBoardPanels(
  flightBoards: FlightBoardsApiResponse | null,
  trafficClock: number,
): ConcourseBoardPanelModel[] {
  const departureEntries = getFilteredBoardEntries(flightBoards?.departures ?? [], 'upcoming', trafficClock);
  const arrivalEntries = getFilteredBoardEntries(flightBoards?.arrivals ?? [], 'upcoming', trafficClock);

  return [
    {
      sectionKey: 'departures',
      title: 'Departures',
      timeColumns: ['STD', 'ETD'],
      routeLabel: 'Destination',
      visibleEntries: departureEntries.slice(0, 18),
      hiddenCount: Math.max(departureEntries.length - 18, 0),
      count: getBoardEntryCounts(flightBoards?.departures ?? [], trafficClock).upcoming,
    },
    {
      sectionKey: 'arrivals',
      title: 'Arrivals',
      timeColumns: ['STA', 'ETA'],
      routeLabel: 'Origin',
      visibleEntries: arrivalEntries.slice(0, 18),
      hiddenCount: Math.max(arrivalEntries.length - 18, 0),
      count: getBoardEntryCounts(flightBoards?.arrivals ?? [], trafficClock).upcoming,
    },
  ];
}

export function buildRouteLabel(
  flightRisk: FlightRiskData | null,
  flightForm: FlightFormState,
): string {
  return flightRisk?.destination
    ? `${flightRisk.origin} -> ${flightRisk.destination.toUpperCase()}`
    : `${flightRisk?.origin ?? flightForm.origin} departure`;
}

export function buildStatusMetrics(
  selectedAirport: AirportStatus,
  selectedCoverageTier: AirportCoverageTier,
  selectedAirportTrafficSummary: string,
  communitySummary?: { reports: number; photos: number },
): StatusMetric[] {
  const liveCommunitySummary = communitySummary ?? {
    reports: selectedAirport.reports,
    photos: selectedAirport.photos,
  };

  return [
    {
      label: 'Coverage',
      value: formatCoverageTierLabel(selectedCoverageTier),
    },
    {
      label: 'Wait source',
      value: formatWaitSourceLabel(selectedAirport.waitTimeSource),
    },
    {
      label: 'Ops source',
      value: formatOpsSourceLabel(selectedAirport.riskSource),
    },
    {
      label: 'Checkpoints',
      value:
        selectedAirport.checkpoints.length > 0
          ? `${selectedAirport.checkpoints.length} live checkpoints`
          : 'No live checkpoint detail',
    },
    {
      label: 'Community',
      value: `${liveCommunitySummary.reports} reports · ${liveCommunitySummary.photos} photos`,
    },
    {
      label: 'Nearby traffic',
      value: selectedAirportTrafficSummary,
    },
  ];
}

export function findAirportByCode(
  airports: AirportStatus[],
  code: AirportCode,
): AirportStatus {
  return airports.find((airport) => airport.code === code) ?? airports[0] ?? fallbackAirports[0];
}

export function findActiveTrafficAircraft(
  focusedTraffic: FocusedTrafficSummary,
  activeTrafficAircraftId: string | null,
): FocusedTrafficNode | null {
  return focusedTraffic.aircraft.find((aircraft) => aircraft.id === activeTrafficAircraftId) ?? null;
}

export function filterAvailableTrafficIds(focusedTraffic: FocusedTrafficSummary): Set<string> {
  return new Set(focusedTraffic.aircraft.map((aircraft) => aircraft.id));
}

export function buildFlightRiskQuery(flightForm: FlightFormState): FlightFormState {
  return {
    origin: flightForm.origin,
    destination: flightForm.destination,
    departureLocalTime: flightForm.departureLocalTime,
  };
}

export function sortReportsByAirportFeed(reports: AirportReport[]): AirportReport[] {
  return [...reports].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}
