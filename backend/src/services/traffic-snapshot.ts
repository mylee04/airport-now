import {
  AIRPORT_METADATA,
  type AirportCode,
} from '../../../shared/airport-status';
import type { TrafficApiResponse, TrafficAircraft } from '../../../shared/traffic';

type OpenSkyState = [
  string | null,
  string | null,
  string | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  boolean | null,
  number | null,
  number | null,
];

type OpenSkyResponse = {
  time?: number;
  states?: OpenSkyState[];
};

type AirplanesLiveAircraft = {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_geom?: number | string | null;
  alt_baro?: number | string | null;
  gs?: number | null;
  track?: number | null;
}

type AirplanesLiveResponse = {
  now?: number;
  ac?: AirplanesLiveAircraft[];
};

type SnapshotCache = {
  expiresAt: number;
  value: TrafficApiResponse;
};

const OPEN_SKY_URL =
  'https://opensky-network.org/api/states/all?lamin=24&lamax=50&lomin=-125&lomax=-66';
const AIRPLANES_LIVE_BASE_URL = 'https://api.airplanes.live/v2/point';
const MAX_RENDERED_AIRCRAFT = 320;
const TRAFFIC_CACHE_MS = 20_000;
const AIRPLANES_LIVE_REQUEST_INTERVAL_MS = 1_100;
const FOCUSED_TRAFFIC_RADIUS_NM = 180;
const AIRPLANES_LIVE_ZONES = [
  { latitude: 45.7, longitude: -122.7, radiusNm: 250 },
  { latitude: 36.5, longitude: -120.0, radiusNm: 250 },
  { latitude: 39.3, longitude: -104.9, radiusNm: 250 },
  { latitude: 32.9, longitude: -97.0, radiusNm: 250 },
  { latitude: 41.9, longitude: -87.7, radiusNm: 250 },
  { latitude: 40.2, longitude: -74.8, radiusNm: 250 },
  { latitude: 33.6, longitude: -84.4, radiusNm: 250 },
  { latitude: 28.4, longitude: -81.3, radiusNm: 250 },
] as const;
const AIRPORT_META_BY_CODE = Object.fromEntries(
  AIRPORT_METADATA.map((airport) => [airport.code, airport]),
) as Record<AirportCode, (typeof AIRPORT_METADATA)[number]>;

let cache: SnapshotCache | null = null;
let lastSuccessfulSnapshot: TrafficApiResponse | null = null;
const focusedTrafficCache = new Map<AirportCode, SnapshotCache>();

function buildEmptyTrafficSnapshot(generatedAt = new Date().toISOString()): TrafficApiResponse {
  return {
    generatedAt,
    airborneCount: 0,
    sampleCount: 0,
    aircraft: [],
  };
}

function toTrafficAircraft(state: OpenSkyState): TrafficAircraft | null {
  const id = state[0]?.trim();
  const longitude = state[5];
  const latitude = state[6];
  const onGround = state[8] === true;

  if (!id || typeof longitude !== 'number' || typeof latitude !== 'number' || onGround) {
    return null;
  }

  return {
    id,
    callsign: state[1]?.trim() || null,
    longitude,
    latitude,
    altitudeMeters: typeof state[7] === 'number' ? state[7] : null,
    onGround,
    velocityMetersPerSecond: typeof state[9] === 'number' ? state[9] : null,
    heading: typeof state[10] === 'number' ? state[10] : null,
  };
}

function sampleAircraft(aircraft: TrafficAircraft[]): TrafficAircraft[] {
  if (aircraft.length <= MAX_RENDERED_AIRCRAFT) {
    return aircraft;
  }

  const step = Math.ceil(aircraft.length / MAX_RENDERED_AIRCRAFT);
  return aircraft.filter((_, index) => index % step === 0).slice(0, MAX_RENDERED_AIRCRAFT);
}

function toAltitudeMeters(value: number | string | null | undefined): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  return value * 0.3048;
}

function toVelocityMetersPerSecond(value: number | null | undefined): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  return value * 0.514444;
}

function toAirplanesLiveTrafficAircraft(entry: AirplanesLiveAircraft): TrafficAircraft | null {
  const id = entry.hex?.trim();

  if (!id || typeof entry.lat !== 'number' || typeof entry.lon !== 'number') {
    return null;
  }

  return {
    id,
    callsign: entry.flight?.trim() || null,
    latitude: entry.lat,
    longitude: entry.lon,
    altitudeMeters: toAltitudeMeters(entry.alt_geom ?? entry.alt_baro),
    onGround: false,
    velocityMetersPerSecond: toVelocityMetersPerSecond(entry.gs),
    heading: typeof entry.track === 'number' ? entry.track : null,
  };
}

function cacheSnapshot(value: TrafficApiResponse, now = Date.now()): TrafficApiResponse {
  cache = {
    expiresAt: now + TRAFFIC_CACHE_MS,
    value,
  };
  lastSuccessfulSnapshot = value;
  return value;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function normalizeEpochMilliseconds(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value > 10_000_000_000 ? value : value * 1000;
}

async function fetchOpenSkySnapshot(): Promise<TrafficApiResponse> {
  const response = await fetch(OPEN_SKY_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenSky states feed returned ${response.status}`);
  }

  const payload = (await response.json()) as OpenSkyResponse;
  const airborne = (payload.states ?? [])
    .map(toTrafficAircraft)
    .filter((entry): entry is TrafficAircraft => entry !== null);
  const aircraft = sampleAircraft(airborne);
  const generatedAt = payload.time ? new Date(payload.time * 1000).toISOString() : new Date().toISOString();

  const value = {
    generatedAt,
    airborneCount: airborne.length,
    sampleCount: aircraft.length,
    aircraft,
  };

  return value;
}

async function fetchAirplanesLiveSnapshot(): Promise<TrafficApiResponse> {
  const mergedAircraft = new Map<string, TrafficAircraft>();
  let latestTimestamp = 0;

  for (let index = 0; index < AIRPLANES_LIVE_ZONES.length; index += 1) {
    const zone = AIRPLANES_LIVE_ZONES[index];
    const payload = await fetchAirplanesLiveResponse(
      `${AIRPLANES_LIVE_BASE_URL}/${zone.latitude}/${zone.longitude}/${zone.radiusNm}`,
    );
    latestTimestamp = Math.max(latestTimestamp, payload.now ?? 0);

    for (const entry of payload.ac ?? []) {
      const aircraft = toAirplanesLiveTrafficAircraft(entry);

      if (aircraft) {
        mergedAircraft.set(aircraft.id, aircraft);
      }
    }

    if (index < AIRPLANES_LIVE_ZONES.length - 1) {
      await wait(AIRPLANES_LIVE_REQUEST_INTERVAL_MS);
    }
  }

  const airborne = Array.from(mergedAircraft.values());
  const aircraft = sampleAircraft(airborne);

  return {
    generatedAt: normalizeEpochMilliseconds(latestTimestamp)
      ? new Date(normalizeEpochMilliseconds(latestTimestamp) ?? Date.now()).toISOString()
      : new Date().toISOString(),
    airborneCount: airborne.length,
    sampleCount: aircraft.length,
    aircraft,
  };
}

async function fetchAirplanesLiveResponse(url: string): Promise<AirplanesLiveResponse> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
      },
    });

    if (response.ok) {
      return (await response.json()) as AirplanesLiveResponse;
    }

    if (response.status === 429 && attempt === 0) {
      const retryAfterSeconds = Number(response.headers.get('retry-after') ?? '10');
      await wait(Math.min(Math.max(retryAfterSeconds, 1), 12) * 1000);
      continue;
    }

    throw new Error(`Airplanes.live point feed returned ${response.status}`);
  }

  throw new Error('Airplanes.live point feed retry exhausted');
}

async function fetchAirplanesLivePointSnapshot(
  latitude: number,
  longitude: number,
  radiusNm: number,
): Promise<TrafficApiResponse> {
  const payload = await fetchAirplanesLiveResponse(
    `${AIRPLANES_LIVE_BASE_URL}/${latitude}/${longitude}/${radiusNm}`,
  );
  const airborne = (payload.ac ?? [])
    .map(toAirplanesLiveTrafficAircraft)
    .filter((entry): entry is TrafficAircraft => entry !== null);
  const aircraft = sampleAircraft(airborne);

  return {
    generatedAt: normalizeEpochMilliseconds(payload.now)
      ? new Date(normalizeEpochMilliseconds(payload.now) ?? Date.now()).toISOString()
      : new Date().toISOString(),
    airborneCount: airborne.length,
    sampleCount: aircraft.length,
    aircraft,
  };
}

export async function getTrafficSnapshot(): Promise<TrafficApiResponse> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  try {
    return cacheSnapshot(await fetchOpenSkySnapshot(), now);
  } catch (openSkyError) {
    try {
      return cacheSnapshot(await fetchAirplanesLiveSnapshot(), now);
    } catch (fallbackError) {
      if (lastSuccessfulSnapshot) {
        cache = {
          expiresAt: now + TRAFFIC_CACHE_MS,
          value: lastSuccessfulSnapshot,
        };

        return lastSuccessfulSnapshot;
      }

      const primaryMessage =
        openSkyError instanceof Error ? openSkyError.message : 'OpenSky primary source failed';
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : 'Airplanes.live fallback failed';
      console.error('Traffic snapshot degraded to empty fallback:', {
        primaryMessage,
        fallbackMessage,
      });

      const emptySnapshot = buildEmptyTrafficSnapshot();
      cache = {
        expiresAt: now + 5_000,
        value: emptySnapshot,
      };

      return emptySnapshot;
    }
  }
}

export async function getAirportTrafficSnapshot(airportCode: AirportCode): Promise<TrafficApiResponse> {
  const now = Date.now();
  const cached = focusedTrafficCache.get(airportCode);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const airport = AIRPORT_META_BY_CODE[airportCode];
  try {
    const value = await fetchAirplanesLivePointSnapshot(
      airport.latitude,
      airport.longitude,
      FOCUSED_TRAFFIC_RADIUS_NM,
    );

    focusedTrafficCache.set(airportCode, {
      expiresAt: now + TRAFFIC_CACHE_MS,
      value,
    });

    return value;
  } catch (error) {
    if (cached) {
      return cached.value;
    }

    throw error;
  }
}
