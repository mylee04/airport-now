import type { AirportCode } from './airport-status';

export type FlightBoardDirection = 'arrival' | 'departure';
export type FlightBoardTimeKind = 'scheduled' | 'estimated' | 'actual';
export type FlightBoardStatusTone = 'default' | 'success' | 'warning' | 'critical' | 'muted';

export type FlightBoardEntry = {
  id: string;
  direction: FlightBoardDirection;
  flightNumber: string;
  marketingFlightNumber: string | null;
  airlineName: string | null;
  counterpartAirportCode: string | null;
  counterpartAirportCity: string | null;
  counterpartAirportName: string | null;
  aircraftType: string | null;
  registration: string | null;
  scheduledTimeLocal: string | null;
  scheduledTimeEpochMs: number | null;
  latestTimeLocal: string | null;
  latestTimeEpochMs: number | null;
  latestTimeKind: FlightBoardTimeKind;
  localTerminal: string | null;
  localGate: string | null;
  localBaggageClaim: string | null;
  statusText: string;
  statusTone: FlightBoardStatusTone;
  statusBackground: string | null;
  statusForeground: string | null;
  codeshares: string[];
  duration: string | null;
  isCancelled: boolean;
  flightUrl: string | null;
};

export type FlightBoardsApiResponse = {
  fetchedAt: string;
  source: {
    label: string;
    url: string;
  };
  airport: {
    code: AirportCode;
    icaoCode: string;
    name: string;
    city: string;
    timeZoneShort: string;
  };
  arrivals: FlightBoardEntry[];
  departures: FlightBoardEntry[];
};
