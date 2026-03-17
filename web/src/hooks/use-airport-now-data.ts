import { startTransition, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { AirportCode, AirportStatus } from '../../../shared/airport-status';
import type { TrafficApiResponse } from '../../../shared/traffic';
import {
  fetchCommunityPhotoWall,
  fetchAirportFlightBoards,
  fetchAirportReports,
  fetchAirportSnapshot,
  fetchAirportTrafficSnapshot,
  fetchFlightRisk,
} from '../lib/airport-api';
import {
  fallbackAirports,
  type FlightBoardsLoadMode,
  type FlightFormState,
  type FlightRiskData,
  type FlightRiskMode,
  type LoadMode,
  type ReportLoadMode,
  type TrafficLoadMode,
  TRAFFIC_REFRESH_INTERVAL_MS,
} from '../lib/airport-now';
import type { FlightBoardsApiResponse } from '../../../shared/flight-board';
import type { AirportReport } from '../../../shared/report';

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

export function useAirportSnapshot(): {
  airports: AirportStatus[];
  mode: LoadMode;
  error: string | null;
  refresh: (signal?: AbortSignal) => Promise<boolean>;
} {
  const [airports, setAirports] = useState<AirportStatus[]>(fallbackAirports);
  const [mode, setMode] = useState<LoadMode>('loading');
  const [error, setError] = useState<string | null>(null);

  const refresh = (signal?: AbortSignal) => {
    return fetchAirportSnapshot(signal)
      .then((snapshot) => {
        startTransition(() => {
          setAirports(snapshot.airports);
          setMode('live');
          setError(null);
        });
        return true;
      })
      .catch((requestError: unknown) => {
        if (signal?.aborted) {
          return false;
        }

        setError(getErrorMessage(requestError, 'Unable to load live airport data.'));
        setMode('fallback');
        return false;
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, []);

  return { airports, mode, error, refresh };
}

export function useAirportTraffic(selectedCode: AirportCode): {
  airportTraffic: TrafficApiResponse | null;
  airportTrafficMode: TrafficLoadMode;
  airportTrafficError: string | null;
} {
  const [airportTraffic, setAirportTraffic] = useState<TrafficApiResponse | null>(null);
  const [airportTrafficMode, setAirportTrafficMode] = useState<TrafficLoadMode>('loading');
  const [airportTrafficError, setAirportTrafficError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAirportTraffic(null);
    setAirportTrafficMode('loading');
    setAirportTrafficError(null);

    const run = () => {
      const controller = new AbortController();

      fetchAirportTrafficSnapshot(selectedCode, controller.signal)
        .then((payload) => {
          if (cancelled) {
            return;
          }

          startTransition(() => {
            setAirportTraffic(payload);
            setAirportTrafficMode('live');
            setAirportTrafficError(null);
          });
        })
        .catch((requestError: unknown) => {
          if (cancelled || controller.signal.aborted) {
            return;
          }

          setAirportTrafficMode('error');
          setAirportTrafficError(getErrorMessage(requestError, 'Unable to load nearby airport traffic.'));
        });

      return controller;
    };

    let activeController = run();
    const interval = window.setInterval(() => {
      activeController.abort();
      activeController = run();
    }, TRAFFIC_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      activeController.abort();
      window.clearInterval(interval);
    };
  }, [selectedCode]);

  return { airportTraffic, airportTrafficMode, airportTrafficError };
}

export function useFlightBoards(selectedCode: AirportCode): {
  flightBoards: FlightBoardsApiResponse | null;
  flightBoardsMode: FlightBoardsLoadMode;
  flightBoardsError: string | null;
} {
  const [flightBoards, setFlightBoards] = useState<FlightBoardsApiResponse | null>(null);
  const [flightBoardsMode, setFlightBoardsMode] = useState<FlightBoardsLoadMode>('idle');
  const [flightBoardsError, setFlightBoardsError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setFlightBoards(null);
    setFlightBoardsMode('loading');
    setFlightBoardsError(null);

    fetchAirportFlightBoards(selectedCode, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setFlightBoards(payload);
          setFlightBoardsMode('ready');
        });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setFlightBoards(null);
        setFlightBoardsError(getErrorMessage(requestError, 'Unable to load airport flight boards.'));
        setFlightBoardsMode('error');
      });

    return () => controller.abort();
  }, [selectedCode]);

  return { flightBoards, flightBoardsMode, flightBoardsError };
}

export function useFlightRisk(flightQuery: FlightFormState): {
  flightRisk: FlightRiskData | null;
  flightRiskMode: FlightRiskMode;
  flightRiskError: string | null;
} {
  const [flightRisk, setFlightRisk] = useState<FlightRiskData | null>(null);
  const [flightRiskMode, setFlightRiskMode] = useState<FlightRiskMode>('idle');
  const [flightRiskError, setFlightRiskError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setFlightRiskMode('loading');
    setFlightRiskError(null);

    fetchFlightRisk(
      {
        origin: flightQuery.origin,
        destination: flightQuery.destination.trim() || null,
        departureLocalTime: flightQuery.departureLocalTime,
      },
      controller.signal,
    )
      .then((payload) => {
        startTransition(() => {
          setFlightRisk(payload.flightRisk);
          setFlightRiskMode('ready');
        });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setFlightRiskError(getErrorMessage(requestError, 'Unable to model route risk right now.'));
        setFlightRiskMode('error');
      });

    return () => controller.abort();
  }, [flightQuery]);

  return { flightRisk, flightRiskMode, flightRiskError };
}

export function useAirportReports(selectedCode: AirportCode): {
  reports: AirportReport[];
  reportsMode: ReportLoadMode;
  reportsError: string | null;
  reloadReports: (signal?: AbortSignal) => Promise<boolean>;
  setReports: Dispatch<SetStateAction<AirportReport[]>>;
  setReportsMode: Dispatch<SetStateAction<ReportLoadMode>>;
  setReportsError: Dispatch<SetStateAction<string | null>>;
} {
  const [reports, setReports] = useState<AirportReport[]>([]);
  const [reportsMode, setReportsMode] = useState<ReportLoadMode>('idle');
  const [reportsError, setReportsError] = useState<string | null>(null);

  const reloadReports = (signal?: AbortSignal) => {
    setReportsMode('loading');
    setReportsError(null);

    return fetchAirportReports(selectedCode, signal)
      .then((payload) => {
        startTransition(() => {
          setReports(payload.reports);
          setReportsMode('ready');
        });
        return true;
      })
      .catch((requestError: unknown) => {
        if (signal?.aborted) {
          return false;
        }

        setReportsError(getErrorMessage(requestError, 'Unable to load community reports.'));
        setReportsMode('error');
        return false;
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    setReports([]);
    void reloadReports(controller.signal);
    return () => controller.abort();
  }, [selectedCode]);

  return {
    reports,
    reportsMode,
    reportsError,
    reloadReports,
    setReports,
    setReportsMode,
    setReportsError,
  };
}

export function useCommunityPhotoWall(): {
  photoReports: AirportReport[];
  photoWallMode: ReportLoadMode;
  photoWallError: string | null;
  reloadPhotoWall: (signal?: AbortSignal) => Promise<boolean>;
} {
  const [photoReports, setPhotoReports] = useState<AirportReport[]>([]);
  const [photoWallMode, setPhotoWallMode] = useState<ReportLoadMode>('idle');
  const [photoWallError, setPhotoWallError] = useState<string | null>(null);

  const reloadPhotoWall = (signal?: AbortSignal) => {
    setPhotoWallMode('loading');
    setPhotoWallError(null);

    return fetchCommunityPhotoWall(signal)
      .then((payload) => {
        startTransition(() => {
          setPhotoReports(payload.reports);
          setPhotoWallMode('ready');
        });
        return true;
      })
      .catch((requestError: unknown) => {
        if (signal?.aborted) {
          return false;
        }

        setPhotoWallError(getErrorMessage(requestError, 'Unable to load the traveler photo wall.'));
        setPhotoWallMode('error');
        return false;
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    void reloadPhotoWall(controller.signal);
    return () => controller.abort();
  }, []);

  return {
    photoReports,
    photoWallMode,
    photoWallError,
    reloadPhotoWall,
  };
}
