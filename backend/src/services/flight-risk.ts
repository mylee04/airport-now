import {
  AIRPORT_CODES,
  type AirportCode,
  type AirportStatus,
  type Confidence,
  type CrowdLevel,
} from '../../../shared/airport-status';
import type { FlightRiskApiResponse, FlightRiskQuery } from '../../../shared/flight-risk';
import { getAirportSnapshot } from './airport-snapshot';
import { getTravelPressure, parseTravelPressureDate } from './travel-pressure';

type DepartureWindowProfile = {
  label: string;
  delayAdjustment: number;
  cancelAdjustment: number;
  driver: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isAirportCode(value: string): value is AirportCode {
  return AIRPORT_CODES.includes(value as AirportCode);
}

function crowdAdjustment(crowdLevel: CrowdLevel): number {
  if (crowdLevel === 'Severe') {
    return 10;
  }

  if (crowdLevel === 'High') {
    return 6;
  }

  if (crowdLevel === 'Low') {
    return -3;
  }

  return 0;
}

function parseDepartureHour(departureLocalTime?: string): number {
  const match = departureLocalTime?.match(/T(\d{2}):(\d{2})/);
  if (!match) {
    return new Date().getHours();
  }

  return Number(match[1]);
}

function profileDepartureWindow(departureHour: number): DepartureWindowProfile {
  if (departureHour >= 4 && departureHour < 8) {
    return {
      label: 'Morning peak bank',
      delayAdjustment: 8,
      cancelAdjustment: 1,
      driver: 'Your departure sits in the early-morning security peak, when queue swings convert into missed boarding margins quickly.',
    };
  }

  if (departureHour >= 15 && departureHour < 20) {
    return {
      label: 'Evening departure bank',
      delayAdjustment: 6,
      cancelAdjustment: 2,
      driver: 'The route is leaving during the evening departure bank, which tends to compress turnaround slack and gate timing.',
    };
  }

  if (departureHour >= 20 || departureHour < 1) {
    return {
      label: 'Late-day bank',
      delayAdjustment: 4,
      cancelAdjustment: 3,
      driver: 'Late-day departures inherit more rolling disruption from earlier delays and tighter aircraft rotations.',
    };
  }

  return {
    label: 'Midday window',
    delayAdjustment: 1,
    cancelAdjustment: 0,
    driver: 'The departure window is outside the sharpest queue banks, so airport pressure matters more than schedule timing.',
  };
}

function deriveConfidence(airport: AirportStatus): Confidence {
  if ((airport.waitTimeSource === 'official' || airport.waitTimeSource === 'community') && airport.riskSource === 'live') {
    return 'High';
  }

  if (airport.waitTimeSource !== 'none' || airport.riskSource !== 'none') {
    return 'Medium';
  }

  return 'Low';
}

function buildDrivers(airport: AirportStatus, window: DepartureWindowProfile): string[] {
  const drivers = [window.driver];

  if (airport.riskSource === 'live') {
    drivers.push(`FAA live operating constraints are already active at ${airport.code}, so route delay risk is elevated before airline-specific factors are added.`);
  } else if (airport.riskSource === 'community') {
    drivers.push(`Recent traveler reports are the strongest live signal at ${airport.code} right now, so queue pressure is influencing this route more than FAA restrictions.`);
  } else {
    drivers.push(`No active FAA disruption signal is currently showing for ${airport.code}, so this route risk leans more heavily on checkpoint pressure and departure timing.`);
  }

  if (airport.waitTimeSource === 'official') {
    drivers.push(`Official checkpoint data currently shows ${airport.waitDisplay.toLowerCase()} at ${airport.code}, which sharpens the queue side of the estimate.`);
  } else if (airport.waitTimeSource === 'official_estimate') {
    drivers.push(`Official checkpoint estimates currently suggest about ${airport.waitDisplay.toLowerCase()} at ${airport.code}, which is useful but softer than a direct live checkpoint feed.`);
  } else if (airport.waitTimeSource === 'community') {
    drivers.push(`Recent traveler reports currently imply about ${airport.waitDisplay.toLowerCase()} at ${airport.code}, which is the best queue signal available right now.`);
  } else {
    drivers.push(`There is no direct live checkpoint feed for ${airport.code} yet, so queue certainty is lower than it would be with an airport wait source.`);
  }

  if (airport.crowdLevel === 'High' || airport.crowdLevel === 'Severe') {
    drivers.push(`${airport.code} is already running at ${airport.crowdLevel.toLowerCase()} crowd conditions, which leaves less slack if boarding gets tight.`);
  }

  if (airport.signals.length > 0) {
    drivers.push(`Current airport signals: ${airport.signals.join(', ')}.`);
  }

  return drivers;
}

function buildRecommendation(delayRisk: number, cancelRisk: number, airport: AirportStatus): string {
  if (delayRisk >= 60 || cancelRisk >= 20) {
    return `Keep this trip on a short leash: monitor airline alerts, check in early, and give yourself extra ground time at ${airport.code}.`;
  }

  if (delayRisk >= 40) {
    return `Build a buffer into this itinerary. The route is still workable, but you do not have much slack if the airport slows down further.`;
  }

  return `This route looks manageable right now. Normal airport timing should be fine unless your airline pushes a separate operational alert.`;
}

function toQuery(origin: string | null, destination: string | null, departureLocalTime: string | null): FlightRiskQuery | null {
  const normalizedOrigin = origin?.toUpperCase();
  if (!normalizedOrigin || !isAirportCode(normalizedOrigin)) {
    return null;
  }

  return {
    origin: normalizedOrigin,
    destination: destination?.trim() || null,
    departureLocalTime: departureLocalTime?.trim() || '',
  };
}

export function parseFlightRiskQuery(url: URL): FlightRiskQuery | null {
  return toQuery(
    url.searchParams.get('origin'),
    url.searchParams.get('destination'),
    url.searchParams.get('departureLocalTime'),
  );
}

export async function getFlightRisk(query: FlightRiskQuery): Promise<FlightRiskApiResponse> {
  const snapshot = await getAirportSnapshot();
  const airport = snapshot.airports.find((entry) => entry.code === query.origin);

  if (!airport) {
    throw new Error(`Unknown airport code: ${query.origin}`);
  }

  const departureDate = parseTravelPressureDate(query.departureLocalTime);
  const departureHour = parseDepartureHour(query.departureLocalTime);
  const departureWindow = profileDepartureWindow(departureHour);
  const travelPressure = getTravelPressure(departureDate);
  const waitAdjustment =
    airport.waitTimeSource === 'official' ||
    airport.waitTimeSource === 'official_estimate' ||
    airport.waitTimeSource === 'community'
      ? airport.waitMinutes >= 20
        ? 5
        : -2
      : 0;
  const liveRiskAdjustment = airport.riskSource === 'live' ? 6 : 0;

  const delayRisk = clamp(
    airport.delayRisk +
      departureWindow.delayAdjustment +
      crowdAdjustment(airport.crowdLevel) +
      waitAdjustment +
      liveRiskAdjustment +
      travelPressure.delayAdjustment,
    5,
    95,
  );
  const cancelRisk = clamp(
    airport.cancelRisk +
      departureWindow.cancelAdjustment +
      (airport.riskSource === 'live' ? 2 : 0) +
      (delayRisk >= 60 ? 3 : 0) +
      travelPressure.cancelAdjustment,
    1,
    85,
  );

  const drivers = buildDrivers(airport, departureWindow);
  if (travelPressure.driverFragments.length > 0) {
    drivers.push(...travelPressure.driverFragments);
  }

  return {
    generatedAt: snapshot.generatedAt,
    query,
    flightRisk: {
      origin: airport.code,
      destination: query.destination,
      departureLocalTime: query.departureLocalTime,
      departureWindowLabel: departureWindow.label,
      delayRisk,
      cancelRisk,
      confidence: deriveConfidence(airport),
      explanation: drivers.slice(0, 2).join(' '),
      recommendation: buildRecommendation(delayRisk, cancelRisk, airport),
      drivers,
      signals: [...airport.signals, ...travelPressure.signals].filter(
        (signal, index, values) => values.indexOf(signal) === index,
      ),
      airportWaitDisplay: airport.waitDisplay,
      airportWaitSource: airport.waitTimeSource,
      airportRiskSource: airport.riskSource,
    },
  };
}
