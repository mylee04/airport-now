import { AIRPORT_METADATA, type AirportCode } from '../../../shared/airport-status';
import type {
  FlightBoardDirection,
  FlightBoardEntry,
  FlightBoardsApiResponse,
  FlightBoardStatusTone,
  FlightBoardTimeKind,
} from '../../../shared/flight-board';

type SnapshotCache = {
  expiresAt: number;
  value: FlightBoardsApiResponse;
};

type RadarBoxAirportPayload = {
  airport?: {
    iata?: string;
    icao?: string;
    name?: string;
    city?: string;
    tzns?: string;
  };
  arrivals?: {
    list?: RadarBoxBoardRow[];
  };
  departures?: {
    list?: RadarBoxBoardRow[];
  };
};

type RadarBoxStatusLabel = {
  text?: string | null;
  bg?: string | null;
  label?: string | null;
};

type RadarBoxBoardRow = {
  fid?: number | string | null;
  fnia?: string | null;
  fnic?: string | null;
  cs?: string | null;
  alna?: string | null;
  act?: string | null;
  acr?: string | null;
  apdstia?: string | null;
  apdstci?: string | null;
  apdstna?: string | null;
  aporgia?: string | null;
  aporgci?: string | null;
  aporgna?: string | null;
  deps?: string | null;
  depe?: string | null;
  departure?: string | null;
  depsu?: number | null;
  depeu?: number | null;
  depau?: number | null;
  arrs?: string | null;
  arre?: string | null;
  arrival?: string | null;
  arrsu?: number | null;
  arreu?: number | null;
  arrau?: number | null;
  depgate?: string | null;
  depterm?: string | null;
  arrgate?: string | null;
  arrterm?: string | null;
  arrbagg?: string | null;
  status?: string | null;
  dep_status?: string | null;
  arr_status?: string | null;
  statusLabel?: RadarBoxStatusLabel | null;
  codeshares?: string | null;
  duration?: string | null;
  cancel?: boolean | null;
};

const BOARD_CACHE_MS = 60_000;
const RADARBOX_BASE_URL = 'https://www.radarbox.com/data/airports';
const AIRPORT_META_BY_CODE = Object.fromEntries(
  AIRPORT_METADATA.map((airport) => [airport.code, airport]),
) as Record<AirportCode, (typeof AIRPORT_METADATA)[number]>;

const boardCache = new Map<AirportCode, SnapshotCache>();
const inFlightBoards = new Map<AirportCode, Promise<FlightBoardsApiResponse>>();
const lastSuccessfulBoards = new Map<AirportCode, FlightBoardsApiResponse>();

function sanitizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function splitCodeshares(value: string | null | undefined): string[] {
  const codeshares = sanitizeText(value);

  if (!codeshares) {
    return [];
  }

  return codeshares
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}

function formatStatusTone(
  status: string | null | undefined,
  labelText: string | null | undefined,
): FlightBoardStatusTone {
  const blob = `${status ?? ''} ${labelText ?? ''}`.toLowerCase();

  if (blob.includes('cancel')) {
    return 'muted';
  }

  if (blob.includes('delay') || blob.includes('late') || blob.includes('estimate')) {
    return 'critical';
  }

  if (blob.includes('landed') || blob.includes('departed') || blob.includes('on-time')) {
    return 'success';
  }

  if (blob.includes('scheduled') || blob.includes('planned')) {
    return 'warning';
  }

  return 'default';
}

function buildFlightUrl(row: RadarBoxBoardRow): string | null {
  const flightNumber = sanitizeText(row.fnia);
  const flightId = row.fid;

  if (!flightNumber || (typeof flightId !== 'string' && typeof flightId !== 'number')) {
    return null;
  }

  return `https://www.radarbox.com/data/flights/${flightNumber}/${flightId}`;
}

function normalizeEpochMilliseconds(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value > 10_000_000_000 ? value : value * 1000;
}

function getScheduledTime(row: RadarBoxBoardRow, direction: FlightBoardDirection): string | null {
  return direction === 'arrival' ? sanitizeText(row.arrs) : sanitizeText(row.deps);
}

function getScheduledTimeEpochMs(row: RadarBoxBoardRow, direction: FlightBoardDirection): number | null {
  return direction === 'arrival'
    ? normalizeEpochMilliseconds(row.arrsu)
    : normalizeEpochMilliseconds(row.depsu);
}

function getLatestTime(row: RadarBoxBoardRow, direction: FlightBoardDirection): string | null {
  if (direction === 'arrival') {
    return sanitizeText(row.arrival) ?? sanitizeText(row.arre) ?? sanitizeText(row.arrs);
  }

  return sanitizeText(row.departure) ?? sanitizeText(row.depe) ?? sanitizeText(row.deps);
}

function getLatestTimeEpochMs(row: RadarBoxBoardRow, direction: FlightBoardDirection): number | null {
  if (direction === 'arrival') {
    return (
      normalizeEpochMilliseconds(row.arrau) ??
      normalizeEpochMilliseconds(row.arreu) ??
      normalizeEpochMilliseconds(row.arrsu)
    );
  }

  return (
    normalizeEpochMilliseconds(row.depau) ??
    normalizeEpochMilliseconds(row.depeu) ??
    normalizeEpochMilliseconds(row.depsu)
  );
}

function getLatestTimeKind(row: RadarBoxBoardRow, direction: FlightBoardDirection): FlightBoardTimeKind {
  if (direction === 'arrival') {
    if (sanitizeText(row.arrival)) {
      return 'actual';
    }

    if (sanitizeText(row.arre) && sanitizeText(row.arre) !== sanitizeText(row.arrs)) {
      return 'estimated';
    }

    return 'scheduled';
  }

  if (sanitizeText(row.departure)) {
    return 'actual';
  }

  if (sanitizeText(row.depe) && sanitizeText(row.depe) !== sanitizeText(row.deps)) {
    return 'estimated';
  }

  return 'scheduled';
}

function getLocalGate(row: RadarBoxBoardRow, direction: FlightBoardDirection): string | null {
  return direction === 'arrival' ? sanitizeText(row.arrgate) : sanitizeText(row.depgate);
}

function getLocalTerminal(row: RadarBoxBoardRow, direction: FlightBoardDirection): string | null {
  return direction === 'arrival' ? sanitizeText(row.arrterm) : sanitizeText(row.depterm);
}

function getCounterpartAirportCode(row: RadarBoxBoardRow, direction: FlightBoardDirection): string | null {
  return direction === 'arrival' ? sanitizeText(row.aporgia) : sanitizeText(row.apdstia);
}

function getCounterpartAirportCity(row: RadarBoxBoardRow, direction: FlightBoardDirection): string | null {
  return direction === 'arrival' ? sanitizeText(row.aporgci) : sanitizeText(row.apdstci);
}

function getCounterpartAirportName(row: RadarBoxBoardRow, direction: FlightBoardDirection): string | null {
  return direction === 'arrival' ? sanitizeText(row.aporgna) : sanitizeText(row.apdstna);
}

function normalizeBoardEntry(row: RadarBoxBoardRow, direction: FlightBoardDirection): FlightBoardEntry {
  const scheduledTimeLocal = getScheduledTime(row, direction);
  const scheduledTimeEpochMs = getScheduledTimeEpochMs(row, direction);
  const latestTimeLocal = getLatestTime(row, direction);
  const latestTimeEpochMs = getLatestTimeEpochMs(row, direction);
  const statusText =
    sanitizeText(row.statusLabel?.text) ??
    sanitizeText(direction === 'arrival' ? row.arr_status : row.dep_status) ??
    sanitizeText(row.status) ??
    'Status n/a';
  const flightNumber = sanitizeText(row.fnia) ?? sanitizeText(row.cs) ?? 'Unknown';
  const rawId =
    (typeof row.fid === 'number' || typeof row.fid === 'string' ? String(row.fid) : null) ??
    sanitizeText(row.fnic) ??
    `${direction}-${flightNumber}-${scheduledTimeLocal ?? 'time-pending'}`;

  return {
    id: rawId,
    direction,
    flightNumber,
    marketingFlightNumber: sanitizeText(row.cs),
    airlineName: sanitizeText(row.alna),
    counterpartAirportCode: getCounterpartAirportCode(row, direction),
    counterpartAirportCity: getCounterpartAirportCity(row, direction),
    counterpartAirportName: getCounterpartAirportName(row, direction),
    aircraftType: sanitizeText(row.act),
    registration: sanitizeText(row.acr),
    scheduledTimeLocal,
    scheduledTimeEpochMs,
    latestTimeLocal,
    latestTimeEpochMs,
    latestTimeKind: getLatestTimeKind(row, direction),
    localTerminal: getLocalTerminal(row, direction),
    localGate: getLocalGate(row, direction),
    localBaggageClaim: direction === 'arrival' ? sanitizeText(row.arrbagg) : null,
    statusText,
    statusTone: formatStatusTone(row.status, statusText),
    statusBackground: sanitizeText(row.statusLabel?.bg),
    statusForeground: sanitizeText(row.statusLabel?.label),
    codeshares: splitCodeshares(row.codeshares),
    duration: sanitizeText(row.duration),
    isCancelled: row.cancel === true || statusText.toLowerCase().includes('cancel'),
    flightUrl: buildFlightUrl(row),
  };
}

function extractWindowInitPayload(html: string): RadarBoxAirportPayload {
  const marker = 'window.init(';
  const startIndex = html.indexOf(marker);

  if (startIndex < 0) {
    throw new Error('RadarBox airport payload marker was not found.');
  }

  const jsonStart = html.indexOf('{', startIndex);

  if (jsonStart < 0) {
    throw new Error('RadarBox airport payload did not include a JSON object.');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = jsonStart; index < html.length; index += 1) {
    const character = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      depth += 1;
      continue;
    }

    if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        const payload = html.slice(jsonStart, index + 1);
        return JSON.parse(payload) as RadarBoxAirportPayload;
      }
    }
  }

  throw new Error('RadarBox airport payload ended unexpectedly.');
}

async function fetchAirportBoards(airportCode: AirportCode): Promise<FlightBoardsApiResponse> {
  const airportMeta = AIRPORT_META_BY_CODE[airportCode];
  const response = await fetch(`${RADARBOX_BASE_URL}/${airportCode}`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`RadarBox airport board returned ${response.status}`);
  }

  const html = await response.text();
  const payload = extractWindowInitPayload(html);
  const fetchedAt = new Date().toISOString();

  return {
    fetchedAt,
    source: {
      label: 'RadarBox public airport board',
      url: `${RADARBOX_BASE_URL}/${airportCode}`,
    },
    airport: {
      code: airportCode,
      icaoCode: payload.airport?.icao ?? airportMeta.icaoCode,
      name: payload.airport?.name ?? airportMeta.name,
      city: payload.airport?.city ?? airportMeta.city,
      timeZoneShort: payload.airport?.tzns ?? 'Local',
    },
    arrivals: (payload.arrivals?.list ?? []).map((row) => normalizeBoardEntry(row, 'arrival')),
    departures: (payload.departures?.list ?? []).map((row) => normalizeBoardEntry(row, 'departure')),
  };
}

export async function getFlightBoards(airportCode: AirportCode): Promise<FlightBoardsApiResponse> {
  const now = Date.now();
  const cached = boardCache.get(airportCode);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const activeRequest = inFlightBoards.get(airportCode);

  if (activeRequest) {
    return activeRequest;
  }

  const request = fetchAirportBoards(airportCode)
    .then((value) => {
      boardCache.set(airportCode, {
        expiresAt: now + BOARD_CACHE_MS,
        value,
      });
      lastSuccessfulBoards.set(airportCode, value);
      return value;
    })
    .catch((error: unknown) => {
      const stale = lastSuccessfulBoards.get(airportCode);

      if (stale) {
        return stale;
      }

      throw error;
    })
    .finally(() => {
      inFlightBoards.delete(airportCode);
    });

  inFlightBoards.set(airportCode, request);
  return request;
}
