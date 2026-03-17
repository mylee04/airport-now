import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AirportReport } from '../../../../shared/report';
import {
  DATA_DIR,
  MAX_PHOTO_BYTES,
  PersistedReportsFile,
  REPORTS_STORE_FILE,
  UPLOADS_DIR,
  getUploadFilename,
  normalizeStoredReport,
  sortReportsByCreatedAt,
  sanitizeFilename,
} from './shared';

export function ensureStorageDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function loadReportsFromDisk(): AirportReport[] {
  ensureStorageDirs();

  if (!existsSync(REPORTS_STORE_FILE)) {
    return [];
  }

  try {
    const raw = readFileSync(REPORTS_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { reports?: unknown };
    const storedReports = Array.isArray(parsed.reports) ? parsed.reports : [];

    return sortReportsByCreatedAt(
      storedReports
        .map((entry) => normalizeStoredReport(entry))
        .filter((entry): entry is AirportReport => entry !== null),
    );
  } catch (error) {
    console.error('Unable to load persisted airport reports:', error);
    return [];
  }
}

export function persistReports(reports: AirportReport[]): void {
  ensureStorageDirs();

  const payload: PersistedReportsFile = {
    version: 1,
    reports: sortReportsByCreatedAt(reports),
  };

  writeFileSync(REPORTS_STORE_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

export async function savePhoto(file: File): Promise<{ photoUrl: string; photoFilename: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('photo must be an image');
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('photo must be 5 MB or smaller');
  }

  ensureStorageDirs();

  const originalName = sanitizeFilename(file.name || 'upload.jpg');
  const extension = originalName.includes('.') ? originalName.split('.').at(-1) : 'jpg';
  const storedName = `${crypto.randomUUID()}.${extension}`;
  const fileUrl = new URL(storedName, UPLOADS_DIR);

  writeFileSync(fileUrl, Buffer.from(await file.arrayBuffer()));

  return {
    photoUrl: `/api/uploads?file=${encodeURIComponent(storedName)}`,
    photoFilename: originalName,
  };
}

export function deletePhotoAsset(photoUrl: string | null): void {
  const filename = getUploadFilename(photoUrl);
  if (!filename) {
    return;
  }

  const fileUrl = new URL(filename, UPLOADS_DIR);
  if (existsSync(fileUrl)) {
    rmSync(fileUrl, { force: true });
  }
}
