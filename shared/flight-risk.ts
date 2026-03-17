import type { AirportCode, Confidence, RiskSource, WaitTimeSource } from './airport-status';

export type FlightRiskQuery = {
  origin: AirportCode;
  destination: string | null;
  departureLocalTime: string;
};

export type FlightRiskResult = {
  origin: AirportCode;
  destination: string | null;
  departureLocalTime: string;
  departureWindowLabel: string;
  delayRisk: number;
  cancelRisk: number;
  confidence: Confidence;
  explanation: string;
  recommendation: string;
  drivers: string[];
  signals: string[];
  airportWaitDisplay: string;
  airportWaitSource: WaitTimeSource;
  airportRiskSource: RiskSource;
};

export type FlightRiskApiResponse = {
  generatedAt: string;
  query: FlightRiskQuery;
  flightRisk: FlightRiskResult;
};
