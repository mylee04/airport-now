import type { AirportsApiResponse } from '../../../shared/airport-status';
import type { FlightRiskApiResponse, FlightRiskQuery } from '../../../shared/flight-risk';
import type { FlightBoardsApiResponse } from '../../../shared/flight-board';
import type { AirportCode } from '../../../shared/airport-status';
import type { AirportReportsApiResponse } from '../../../shared/report';
import type { TrafficApiResponse } from '../../../shared/traffic';

function resolveApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;

    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return '';
    }
  }

  return 'http://localhost:8787';
}

const API_BASE_URL = resolveApiBaseUrl();

export async function fetchAirportSnapshot(signal?: AbortSignal): Promise<AirportsApiResponse> {
  const response = await fetch(`${API_BASE_URL}/api/airports`, { signal });

  if (!response.ok) {
    throw new Error(`Airport snapshot request failed with ${response.status}`);
  }

  return response.json() as Promise<AirportsApiResponse>;
}

export async function fetchTrafficSnapshot(signal?: AbortSignal): Promise<TrafficApiResponse> {
  const response = await fetch(`${API_BASE_URL}/api/traffic`, { signal });

  if (!response.ok) {
    throw new Error(`Traffic snapshot request failed with ${response.status}`);
  }

  return response.json() as Promise<TrafficApiResponse>;
}

export async function fetchAirportTrafficSnapshot(
  airportCode: AirportCode,
  signal?: AbortSignal,
): Promise<TrafficApiResponse> {
  const response = await fetch(`${API_BASE_URL}/api/traffic?airport=${airportCode}`, { signal });

  if (!response.ok) {
    throw new Error(`Airport traffic request failed with ${response.status}`);
  }

  return response.json() as Promise<TrafficApiResponse>;
}

export async function fetchAirportFlightBoards(
  airportCode: AirportCode,
  signal?: AbortSignal,
): Promise<FlightBoardsApiResponse> {
  const response = await fetch(`${API_BASE_URL}/api/boards?airport=${airportCode}`, { signal });

  if (!response.ok) {
    throw new Error(`Airport board request failed with ${response.status}`);
  }

  return response.json() as Promise<FlightBoardsApiResponse>;
}

export async function fetchFlightRisk(
  query: FlightRiskQuery,
  signal?: AbortSignal,
): Promise<FlightRiskApiResponse> {
  const searchParams = new URLSearchParams({
    origin: query.origin,
    departureLocalTime: query.departureLocalTime,
  });

  if (query.destination) {
    searchParams.set('destination', query.destination);
  }

  const response = await fetch(`${API_BASE_URL}/api/flight-risk?${searchParams.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`Flight risk request failed with ${response.status}`);
  }

  return response.json() as Promise<FlightRiskApiResponse>;
}

export async function fetchAirportReports(
  airportCode: AirportCode,
  signal?: AbortSignal,
): Promise<AirportReportsApiResponse> {
  const response = await fetch(`${API_BASE_URL}/api/reports?airport=${airportCode}`, { signal });

  if (!response.ok) {
    throw new Error(`Airport reports request failed with ${response.status}`);
  }

  return response.json() as Promise<AirportReportsApiResponse>;
}

export async function createAirportReport(formData: FormData): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/reports`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Airport report create failed with ${response.status}`);
  }
}

export function resolveApiAssetUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }

  return `${API_BASE_URL}${path}`;
}
