import type { AirportCode } from './airport-status';

export const REPORT_QUEUE_LENGTHS = ['0-10 min', '10-20 min', '20-40 min', '40+ min'] as const;
export const REPORT_CROWD_LEVELS = ['Quiet', 'Normal', 'Busy', 'Packed'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
export const REPORT_TTL_MS = 7 * DAY_MS;
export const REPORT_TTL_DAYS = REPORT_TTL_MS / DAY_MS;
export const PHOTO_TTL_MS = 30 * DAY_MS;
export const PHOTO_TTL_DAYS = PHOTO_TTL_MS / DAY_MS;

export type ReportQueueLength = (typeof REPORT_QUEUE_LENGTHS)[number];
export type ReportCrowdLevel = (typeof REPORT_CROWD_LEVELS)[number];

export type AirportReport = {
  id: string;
  airportCode: AirportCode;
  checkpoint: string;
  queueLength: ReportQueueLength;
  crowdLevel: ReportCrowdLevel;
  note: string | null;
  photoUrl: string | null;
  photoFilename: string | null;
  createdAt: string;
  expiresAt: string;
  photoExpiresAt: string | null;
};

export type AirportReportsApiResponse = {
  generatedAt: string;
  airportCode: AirportCode;
  reports: AirportReport[];
};

export type CommunityPhotoWallApiResponse = {
  generatedAt: string;
  reports: AirportReport[];
};
