import type { AirportCode } from '../../../shared/airport-status';

type FaaAirportEvent = {
  groundStopReason?: string;
  groundStopUntil?: string;
  groundDelayReason?: string;
  groundDelayAverageMinutes?: number;
  groundDelayMaxMinutes?: number;
  departureDelayReason?: string;
  departureDelayMinMinutes?: number;
  departureDelayMaxMinutes?: number;
  departureDelayTrend?: string;
  closureReason?: string;
  closureReopen?: string;
};

type FaaSnapshot = {
  fetchedAt: string;
  eventsByAirport: Partial<Record<AirportCode, FaaAirportEvent>>;
};

const FAA_URL = 'https://nasstatus.faa.gov/api/airport-status-information';

function extractBlocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  return [...xml.matchAll(pattern)].map((match) => match[1]);
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.trim();
}

function minutesFromText(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  let minutes = 0;

  const hoursMatch = normalized.match(/(\d+)\s+hour/);
  const minutesMatch = normalized.match(/(\d+)\s+minute/);

  if (hoursMatch) {
    minutes += Number(hoursMatch[1]) * 60;
  }

  if (minutesMatch) {
    minutes += Number(minutesMatch[1]);
  }

  if (!hoursMatch && !minutesMatch) {
    const numericOnly = normalized.match(/(\d+)/);
    if (numericOnly) {
      minutes = Number(numericOnly[1]);
    }
  }

  return minutes || undefined;
}

function ensureEvent(
  eventsByAirport: Partial<Record<AirportCode, FaaAirportEvent>>,
  code: AirportCode,
): FaaAirportEvent {
  const current = eventsByAirport[code] ?? {};
  eventsByAirport[code] = current;
  return current;
}

export async function fetchFaaSnapshot(): Promise<FaaSnapshot> {
  const response = await fetch(FAA_URL, {
    headers: {
      Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`FAA feed returned ${response.status}`);
  }

  const xml = await response.text();
  const eventsByAirport: Partial<Record<AirportCode, FaaAirportEvent>> = {};

  for (const block of extractBlocks(xml, 'Program')) {
    const code = extractTag(block, 'ARPT') as AirportCode | undefined;
    if (!code) {
      continue;
    }

    const event = ensureEvent(eventsByAirport, code);
    event.groundStopReason = extractTag(block, 'Reason');
    event.groundStopUntil = extractTag(block, 'End_Time');
  }

  for (const block of extractBlocks(xml, 'Ground_Delay')) {
    const code = extractTag(block, 'ARPT') as AirportCode | undefined;
    if (!code) {
      continue;
    }

    const event = ensureEvent(eventsByAirport, code);
    event.groundDelayReason = extractTag(block, 'Reason');
    event.groundDelayAverageMinutes = minutesFromText(extractTag(block, 'Avg'));
    event.groundDelayMaxMinutes = minutesFromText(extractTag(block, 'Max'));
  }

  for (const block of extractBlocks(xml, 'Delay')) {
    const code = extractTag(block, 'ARPT') as AirportCode | undefined;
    if (!code) {
      continue;
    }

    const event = ensureEvent(eventsByAirport, code);
    event.departureDelayReason = extractTag(block, 'Reason');

    const departureBlock = block.match(
      /<Arrival_Departure[^>]*Type="Departure"[^>]*>([\s\S]*?)<\/Arrival_Departure>/,
    )?.[1];

    if (!departureBlock) {
      continue;
    }

    event.departureDelayMinMinutes = minutesFromText(extractTag(departureBlock, 'Min'));
    event.departureDelayMaxMinutes = minutesFromText(extractTag(departureBlock, 'Max'));
    event.departureDelayTrend = extractTag(departureBlock, 'Trend');
  }

  for (const block of extractBlocks(xml, 'Airport')) {
    const code = extractTag(block, 'ARPT') as AirportCode | undefined;
    if (!code) {
      continue;
    }

    const event = ensureEvent(eventsByAirport, code);
    event.closureReason = extractTag(block, 'Reason');
    event.closureReopen = extractTag(block, 'Reopen');
  }

  return {
    fetchedAt: new Date().toISOString(),
    eventsByAirport,
  };
}
