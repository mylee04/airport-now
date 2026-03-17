import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { del, put } from '@vercel/blob';
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

const REPORTS_BLOB_PATH = 'community/reports.json';
const REPORT_PHOTOS_BLOB_PREFIX = 'community/photos';

export function usesBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function getBlobPublicStoreBaseUrl(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = token?.split('_')[3] ?? '';

  return storeId ? `https://${storeId}.public.blob.vercel-storage.com` : null;
}

export function ensureStorageDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

function loadReportsFromSerializedPayload(raw: string): AirportReport[] {
  const parsed = JSON.parse(raw) as { reports?: unknown };
  const storedReports = Array.isArray(parsed.reports) ? parsed.reports : [];

  return sortReportsByCreatedAt(
    storedReports.map((entry) => normalizeStoredReport(entry)).filter((entry): entry is AirportReport => entry !== null),
  );
}

function loadReportsFromDisk(): AirportReport[] {
  ensureStorageDirs();

  if (!existsSync(REPORTS_STORE_FILE)) {
    return [];
  }

  try {
    return loadReportsFromSerializedPayload(readFileSync(REPORTS_STORE_FILE, 'utf8'));
  } catch (error) {
    console.error('Unable to load persisted airport reports:', error);
    return [];
  }
}

async function loadReportsFromBlob(): Promise<AirportReport[]> {
  try {
    const blobStoreBaseUrl = getBlobPublicStoreBaseUrl();
    if (!blobStoreBaseUrl) {
      return [];
    }

    const blobUrl = new URL(REPORTS_BLOB_PATH, `${blobStoreBaseUrl}/`);
    blobUrl.searchParams.set('v', Date.now().toString());
    const response = await fetch(blobUrl, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Blob report fetch failed with ${response.status}`);
    }

    return loadReportsFromSerializedPayload(await response.text());
  } catch (error) {
    console.error('Unable to load blob-backed airport reports:', error);
    return [];
  }
}

export async function loadReportsFromStorage(): Promise<AirportReport[]> {
  return usesBlobStorage() ? loadReportsFromBlob() : loadReportsFromDisk();
}

function persistReportsToDisk(reports: AirportReport[]): void {
  ensureStorageDirs();

  const payload: PersistedReportsFile = {
    version: 1,
    reports: sortReportsByCreatedAt(reports),
  };

  writeFileSync(REPORTS_STORE_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

export async function persistReports(reports: AirportReport[]): Promise<void> {
  if (!usesBlobStorage()) {
    persistReportsToDisk(reports);
    return;
  }

  const payload: PersistedReportsFile = {
    version: 1,
    reports: sortReportsByCreatedAt(reports),
  };

  await put(REPORTS_BLOB_PATH, JSON.stringify(payload, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: 'application/json; charset=utf-8',
  });
}

function guessEmbeddedPhotoContentType(filename: string): string {
  const extension = filename.toLowerCase().split('.').at(-1);

  switch (extension) {
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

function buildEmbeddedPhotoUrl(contentType: string, bytes: Buffer): string {
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

export async function savePhoto(file: File): Promise<{ photoUrl: string; photoFilename: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('photo must be an image');
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('photo must be 4 MB or smaller');
  }

  ensureStorageDirs();

  const originalName = sanitizeFilename(file.name || 'upload.jpg');
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || guessEmbeddedPhotoContentType(originalName);

  if (usesBlobStorage()) {
    const extension = originalName.includes('.') ? originalName.split('.').at(-1) ?? 'jpg' : 'jpg';
    const blobPath = `${REPORT_PHOTOS_BLOB_PREFIX}/${crypto.randomUUID()}.${extension}`;
    const uploadedPhoto = await put(blobPath, bytes, {
      access: 'public',
      addRandomSuffix: false,
      contentType,
      cacheControlMaxAge: 60 * 60 * 2,
    });

    return {
      photoUrl: uploadedPhoto.url,
      photoFilename: originalName,
    };
  }

  return {
    photoUrl: buildEmbeddedPhotoUrl(contentType, bytes),
    photoFilename: originalName,
  };
}

export function resolveStoredPhotoUrl(photoUrl: string | null): string | null {
  if (!photoUrl) {
    return null;
  }

  if (
    photoUrl.startsWith('data:image/') ||
    photoUrl.startsWith('http://') ||
    photoUrl.startsWith('https://')
  ) {
    return photoUrl;
  }

  const filename = getUploadFilename(photoUrl);
  if (!filename) {
    return photoUrl;
  }

  const fileUrl = new URL(filename, UPLOADS_DIR);
  if (!existsSync(fileUrl)) {
    return null;
  }

  return buildEmbeddedPhotoUrl(guessEmbeddedPhotoContentType(filename), readFileSync(fileUrl));
}

export async function deletePhotoAsset(photoUrl: string | null): Promise<void> {
  if (!photoUrl) {
    return;
  }

  if (usesBlobStorage() && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))) {
    await del(photoUrl);
    return;
  }

  const filename = getUploadFilename(photoUrl);
  if (!filename) {
    return;
  }

  const fileUrl = new URL(filename, UPLOADS_DIR);
  if (existsSync(fileUrl)) {
    rmSync(fileUrl, { force: true });
  }
}
