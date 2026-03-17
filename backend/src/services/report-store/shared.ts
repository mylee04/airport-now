import { AIRPORT_CODES, type AirportCode } from '../../../../shared/airport-status';
import {
  REPORT_CROWD_LEVELS,
  REPORT_QUEUE_LENGTHS,
  REPORT_TTL_MS,
  type AirportReport,
  type ReportCrowdLevel,
  type ReportQueueLength,
} from '../../../../shared/report';

export type ReportSummary = {
  reportCount: number;
  photoCount: number;
  strongestQueueMinutes: number;
  busyReportCount: number;
  packedReportCount: number;
  latestNote: string | null;
  latestCheckpoint: string | null;
};

export type PersistedReportsFile = {
  version: 1;
  reports: AirportReport[];
};

const STORAGE_ROOT_URL = process.env.VERCEL
  ? new URL('file:///tmp/airport-now/')
  : new URL('../../../', import.meta.url);

export const UPLOADS_DIR = new URL('uploads/', STORAGE_ROOT_URL);
export const DATA_DIR = new URL('data/', STORAGE_ROOT_URL);
export const REPORTS_STORE_FILE = new URL('reports.json', DATA_DIR);
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const CLEANUP_INTERVAL_MS = 60_000;

export function isAirportCode(value: string): value is AirportCode {
  return AIRPORT_CODES.includes(value as AirportCode);
}

export function isQueueLength(value: string): value is ReportQueueLength {
  return REPORT_QUEUE_LENGTHS.includes(value as ReportQueueLength);
}

export function isCrowdLevel(value: string): value is ReportCrowdLevel {
  return REPORT_CROWD_LEVELS.includes(value as ReportCrowdLevel);
}

export function queueLengthToMinutes(queueLength: ReportQueueLength): number {
  if (queueLength === '0-10 min') {
    return 10;
  }

  if (queueLength === '10-20 min') {
    return 20;
  }

  if (queueLength === '20-40 min') {
    return 40;
  }

  return 55;
}

export function sanitizeCheckpoint(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function sanitizeNote(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 240) : null;
}

export function sanitizeFilename(filename: string): string {
  const safe = filename.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  return safe.replace(/-+/g, '-').slice(-64) || 'upload.jpg';
}

export function sortReportsByCreatedAt(items: AirportReport[]): AirportReport[] {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function buildExpiryTimestamp(createdAt: string): string {
  return new Date(new Date(createdAt).getTime() + REPORT_TTL_MS).toISOString();
}

export function normalizeStoredReport(value: unknown): AirportReport | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AirportReport>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.airportCode !== 'string' ||
    !isAirportCode(candidate.airportCode) ||
    typeof candidate.checkpoint !== 'string' ||
    typeof candidate.queueLength !== 'string' ||
    !isQueueLength(candidate.queueLength) ||
    typeof candidate.crowdLevel !== 'string' ||
    !isCrowdLevel(candidate.crowdLevel) ||
    typeof candidate.createdAt !== 'string'
  ) {
    return null;
  }

  const createdAtMs = new Date(candidate.createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return null;
  }

  const normalizedExpiresAt =
    typeof candidate.expiresAt === 'string' && Number.isFinite(new Date(candidate.expiresAt).getTime())
      ? candidate.expiresAt
      : buildExpiryTimestamp(candidate.createdAt);

  return {
    id: candidate.id,
    airportCode: candidate.airportCode,
    checkpoint: sanitizeCheckpoint(candidate.checkpoint),
    queueLength: candidate.queueLength,
    crowdLevel: candidate.crowdLevel,
    note: sanitizeNote(typeof candidate.note === 'string' ? candidate.note : null),
    photoUrl: typeof candidate.photoUrl === 'string' ? candidate.photoUrl : null,
    photoFilename: typeof candidate.photoFilename === 'string' ? candidate.photoFilename : null,
    createdAt: candidate.createdAt,
    expiresAt: normalizedExpiresAt,
  };
}

export function getUploadFilename(photoUrl: string | null): string | null {
  if (photoUrl?.startsWith('/uploads/')) {
    const filename = photoUrl.slice('/uploads/'.length);
    return /^[a-zA-Z0-9._-]+$/.test(filename) ? filename : null;
  }

  if (photoUrl?.startsWith('/api/uploads?')) {
    const url = new URL(photoUrl, 'http://localhost');
    const filename = url.searchParams.get('file');
    return filename && /^[a-zA-Z0-9._-]+$/.test(filename) ? filename : null;
  }

  return null;
}
