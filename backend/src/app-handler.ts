import { existsSync, readFileSync } from 'node:fs';
import { AIRPORT_CODES, type AirportCode } from '../../shared/airport-status';
import { getFlightBoards } from './services/flight-boards';
import { getFlightRisk, parseFlightRiskQuery } from './services/flight-risk';
import {
  createAirportReport,
  initializeReportStore,
  listAirportReports,
  listCommunityPhotoWallReports,
  setReportStoreChangeListener,
} from './services/report-store';
import { getUploadFilename, UPLOADS_DIR } from './services/report-store/shared';
import { getAirportSnapshot, invalidateAirportSnapshotCache } from './services/airport-snapshot';
import { getAirportTrafficSnapshot, getTrafficSnapshot } from './services/traffic-snapshot';

let initialized = false;
let initializePromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (initialized) {
    return;
  }

  if (initializePromise) {
    await initializePromise;
    return;
  }

  setReportStoreChangeListener(() => {
    invalidateAirportSnapshotCache();
  });
  initializePromise = initializeReportStore()
    .then(() => {
      initialized = true;
    })
    .finally(() => {
      initializePromise = null;
    });
  await initializePromise;
}

function isAirportCode(value: string): value is AirportCode {
  return AIRPORT_CODES.includes(value as AirportCode);
}

function guessContentType(filename: string): string {
  const extension = filename.toLowerCase().split('.').at(-1);

  switch (extension) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'application/octet-stream';
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function getUploadFilenameFromRequest(url: URL): string | null {
  if (url.pathname === '/api/uploads') {
    const filename = url.searchParams.get('file');
    return filename && /^[a-zA-Z0-9._-]+$/.test(filename) ? filename : null;
  }

  return getUploadFilename(url.pathname);
}

async function serveUpload(url: URL): Promise<Response> {
  const filename = getUploadFilenameFromRequest(url);

  if (!filename) {
    return json({ error: 'invalid_upload_path' }, 400);
  }

  const fileUrl = new URL(filename, UPLOADS_DIR);
  if (!existsSync(fileUrl)) {
    return json({ error: 'not_found' }, 404);
  }

  return new Response(readFileSync(fileUrl), {
    headers: {
      'Content-Type': guessContentType(filename),
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function handleAppRequest(request: Request): Promise<Response> {
  await ensureInitialized();

  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return json({}, 204);
  }

  if (url.pathname === '/health' || url.pathname === '/api/health') {
    return json({ ok: true, service: 'airport-now-api' });
  }

  if (url.pathname === '/api/uploads' || url.pathname.startsWith('/uploads/')) {
    return serveUpload(url);
  }

  if (url.pathname === '/api/flight-risk') {
    const query = parseFlightRiskQuery(url);

    if (!query) {
      return json(
        {
          error: 'invalid_query',
          message: 'origin must be one of the launch airport codes',
        },
        400,
      );
    }

    try {
      return json(await getFlightRisk(query));
    } catch (error) {
      return json(
        {
          error: 'flight_risk_unavailable',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      );
    }
  }

  if (url.pathname === '/api/reports' && request.method === 'GET') {
    const airportCode = url.searchParams.get('airport')?.toUpperCase();

    if (!airportCode || !isAirportCode(airportCode)) {
      return json(
        {
          error: 'invalid_query',
          message: 'airport must be one of the launch airport codes',
        },
        400,
      );
    }

    return json(await listAirportReports(airportCode));
  }

  if (url.pathname === '/api/reports/photos' && request.method === 'GET') {
    const airportCodeParam = url.searchParams.get('airport')?.toUpperCase();

    if (airportCodeParam && !isAirportCode(airportCodeParam)) {
      return json(
        {
          error: 'invalid_query',
          message: 'airport must be one of the launch airport codes',
        },
        400,
      );
    }

    const airportCode = airportCodeParam && isAirportCode(airportCodeParam) ? airportCodeParam : undefined;
    return json(await listCommunityPhotoWallReports(airportCode));
  }

  if (url.pathname === '/api/reports' && request.method === 'POST') {
    try {
      const report = await createAirportReport(request);
      return json({ ok: true, report }, 201);
    } catch (error) {
      return json(
        {
          error: 'report_create_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        400,
      );
    }
  }

  if (url.pathname === '/api/airports') {
    try {
      return json(await getAirportSnapshot());
    } catch (error) {
      return json(
        {
          error: 'snapshot_unavailable',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      );
    }
  }

  if (url.pathname === '/api/traffic') {
    const airportCode = url.searchParams.get('airport')?.toUpperCase();

    if (airportCode) {
      if (!isAirportCode(airportCode)) {
        return json(
          {
            error: 'invalid_query',
            message: 'airport must be one of the launch airport codes',
          },
          400,
        );
      }

      try {
        return json(await getAirportTrafficSnapshot(airportCode));
      } catch (error) {
        return json(
          {
            error: 'traffic_unavailable',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500,
        );
      }
    }

    try {
      return json(await getTrafficSnapshot());
    } catch (error) {
      return json(
        {
          error: 'traffic_unavailable',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      );
    }
  }

  if (url.pathname === '/api/boards') {
    const airportCode = url.searchParams.get('airport')?.toUpperCase();

    if (!airportCode || !isAirportCode(airportCode)) {
      return json(
        {
          error: 'invalid_query',
          message: 'airport must be one of the launch airport codes',
        },
        400,
      );
    }

    try {
      return json(await getFlightBoards(airportCode));
    } catch (error) {
      return json(
        {
          error: 'boards_unavailable',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      );
    }
  }

  if (url.pathname.startsWith('/api/airports/')) {
    try {
      const snapshot = await getAirportSnapshot();
      const code = url.pathname.split('/').at(-1)?.toUpperCase();
      const airport = snapshot.airports.find((entry) => entry.code === code);

      if (!airport) {
        return json({ error: 'not_found' }, 404);
      }

      return json({
        generatedAt: snapshot.generatedAt,
        airport,
      });
    } catch (error) {
      return json(
        {
          error: 'airport_lookup_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      );
    }
  }

  return json({ error: 'not_found' }, 404);
}
