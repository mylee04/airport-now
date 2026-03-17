import type { AirportCode } from '../../../../shared/airport-status';
import type { AirportReport, AirportReportsApiResponse, CommunityPhotoWallApiResponse } from '../../../../shared/report';
import {
  deletePhotoAsset,
  loadReportsFromStorage,
  persistReports,
  resolveStoredPhotoUrl,
  savePhoto,
  usesBlobStorage,
} from './repository';
import {
  CLEANUP_INTERVAL_MS,
  ReportSummary,
  buildExpiryTimestamp,
  isAirportCode,
  isCrowdLevel,
  isQueueLength,
  queueLengthToMinutes,
  sanitizeCheckpoint,
  sanitizeNote,
  sortReportsByCreatedAt,
} from './shared';

let reports: AirportReport[] = [];
let reportsChangedListener: (() => void) | null = null;
let cleanupStarted = false;
let reportStoreOperation: Promise<void> = Promise.resolve();

function runWithReportStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const nextOperation = reportStoreOperation.then(operation, operation);
  reportStoreOperation = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

function emitReportsChanged(): void {
  reportsChangedListener?.();
}

async function refreshReportsFromStorage(): Promise<void> {
  if (!usesBlobStorage()) {
    return;
  }

  reports = await loadReportsFromStorage();
}

function isExpiredReport(report: AirportReport, now = new Date()): boolean {
  return new Date(report.expiresAt).getTime() <= now.getTime();
}

async function pruneExpiredReports(now = new Date(), shouldEmit = true): Promise<boolean> {
  const activeReports: AirportReport[] = [];
  const expiredReports: AirportReport[] = [];

  for (const report of reports) {
    if (isExpiredReport(report, now)) {
      expiredReports.push(report);
    } else {
      activeReports.push(report);
    }
  }

  if (expiredReports.length === 0) {
    return false;
  }

  reports = sortReportsByCreatedAt(activeReports);

  await Promise.all(expiredReports.map((report) => deletePhotoAsset(report.photoUrl)));

  await persistReports(reports);

  if (shouldEmit) {
    emitReportsChanged();
  }

  return true;
}

function startCleanupLoop(): void {
  if (cleanupStarted) {
    return;
  }

  cleanupStarted = true;
  const timer = setInterval(() => {
    void runWithReportStoreLock(async () => {
      await pruneExpiredReports();
    }).catch((error) => {
      console.error('Airport report cleanup failed:', error);
    });
  }, CLEANUP_INTERVAL_MS);

  timer.unref?.();
}

export async function initializeReportStore(): Promise<void> {
  await runWithReportStoreLock(async () => {
    reports = await loadReportsFromStorage();
    await pruneExpiredReports(new Date(), false);
    startCleanupLoop();
  });
}

export function setReportStoreChangeListener(listener: (() => void) | null): void {
  reportsChangedListener = listener;
}

export async function listAirportReports(airportCode: AirportCode): Promise<AirportReportsApiResponse> {
  return runWithReportStoreLock(async () => {
    await refreshReportsFromStorage();
    await pruneExpiredReports();

    return {
      generatedAt: new Date().toISOString(),
      airportCode,
      reports: sortReportsByCreatedAt(
        reports
          .filter((report) => report.airportCode === airportCode)
          .map((report) => ({
            ...report,
            photoUrl: resolveStoredPhotoUrl(report.photoUrl),
          })),
      ),
    };
  });
}

export async function listCommunityPhotoWallReports(): Promise<CommunityPhotoWallApiResponse> {
  return runWithReportStoreLock(async () => {
    await refreshReportsFromStorage();
    await pruneExpiredReports();

    return {
      generatedAt: new Date().toISOString(),
      reports: sortReportsByCreatedAt(
        reports
          .filter((report) => Boolean(report.photoUrl))
          .map((report) => ({
            ...report,
            photoUrl: resolveStoredPhotoUrl(report.photoUrl),
          })),
      ),
    };
  });
}

export async function createAirportReport(request: Request): Promise<AirportReport> {
  return runWithReportStoreLock(async () => {
    await refreshReportsFromStorage();
    await pruneExpiredReports();

    const formData = await request.formData();
    const airportCodeValue = formData.get('airportCode');
    const checkpointValue = formData.get('checkpoint');
    const queueLengthValue = formData.get('queueLength');
    const crowdLevelValue = formData.get('crowdLevel');

    if (
      typeof airportCodeValue !== 'string' ||
      typeof checkpointValue !== 'string' ||
      typeof queueLengthValue !== 'string' ||
      typeof crowdLevelValue !== 'string'
    ) {
      throw new Error('airportCode, checkpoint, queueLength, and crowdLevel are required');
    }

    if (!isAirportCode(airportCodeValue.toUpperCase())) {
      throw new Error('airportCode must match a launch airport');
    }

    if (!isQueueLength(queueLengthValue) || !isCrowdLevel(crowdLevelValue)) {
      throw new Error('queueLength or crowdLevel is invalid');
    }

    const checkpoint = sanitizeCheckpoint(checkpointValue);
    if (!checkpoint) {
      throw new Error('checkpoint is required');
    }

    const noteValue = formData.get('note');
    const note = typeof noteValue === 'string' ? sanitizeNote(noteValue) : null;

    let photoUrl: string | null = null;
    let photoFilename: string | null = null;
    const photoValue = formData.get('photo');

    if (photoValue instanceof File && photoValue.size > 0) {
      const savedPhoto = await savePhoto(photoValue);
      photoUrl = savedPhoto.photoUrl;
      photoFilename = savedPhoto.photoFilename;
    }

    const createdAt = new Date().toISOString();
    const report: AirportReport = {
      id: crypto.randomUUID(),
      airportCode: airportCodeValue.toUpperCase() as AirportCode,
      checkpoint,
      queueLength: queueLengthValue,
      crowdLevel: crowdLevelValue,
      note,
      photoUrl,
      photoFilename,
      createdAt,
      expiresAt: buildExpiryTimestamp(createdAt),
    };

    const nextReports = sortReportsByCreatedAt([report, ...reports]);

    try {
      reports = nextReports;
      await persistReports(reports);
    } catch (error) {
      await deletePhotoAsset(photoUrl);
      reports = reports.filter((existingReport) => existingReport.id !== report.id);
      throw error;
    }

    emitReportsChanged();
    return report;
  });
}

export async function getRecentReportSummaryByAirport(
  now = new Date(),
): Promise<Partial<Record<AirportCode, ReportSummary>>> {
  return runWithReportStoreLock(async () => {
    await refreshReportsFromStorage();
    await pruneExpiredReports(now);
    const summaries: Partial<Record<AirportCode, ReportSummary>> = {};

    for (const report of reports) {
      const summary = summaries[report.airportCode] ?? {
        reportCount: 0,
        photoCount: 0,
        strongestQueueMinutes: 0,
        busyReportCount: 0,
        packedReportCount: 0,
        latestNote: null,
        latestCheckpoint: null,
      };

      summary.reportCount += 1;
      summary.photoCount += report.photoUrl ? 1 : 0;
      summary.strongestQueueMinutes = Math.max(summary.strongestQueueMinutes, queueLengthToMinutes(report.queueLength));
      summary.busyReportCount += report.crowdLevel === 'Busy' ? 1 : 0;
      summary.packedReportCount += report.crowdLevel === 'Packed' ? 1 : 0;

      if (!summary.latestNote && report.note) {
        summary.latestNote = report.note;
      }

      if (!summary.latestCheckpoint) {
        summary.latestCheckpoint = report.checkpoint;
      }

      summaries[report.airportCode] = summary;
    }

    return summaries;
  });
}
