import type { AirportCheckpoint } from '../../../shared/airport-status';
import { fetchWithTimeout } from './shared-upstream';

type ChsWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const CHS_WAIT_URL = 'https://iflychs.com/passengers/security-checkpoint/';

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#10004;/g, '')
    .replace(/&#8482;/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function parseCheckpointCards(html: string): AirportCheckpoint[] {
  const matches = [
    ...html.matchAll(
      /<div class="chs-tsa-checkpoint-card">[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<div class="chs-tsa-wait-time[^"]*">\s*([^<]+?)\s*<\/div>/gi,
    ),
  ];

  if (matches.length === 0) {
    throw new Error('CHS wait page did not expose any checkpoint cards');
  }

  return matches.map((match, index) => {
    const rawLabel = stripTags(match[1] ?? '');
    const waitMinutes = Number(stripTags(match[2] ?? '').match(/(\d+)/)?.[1] ?? 0);
    if (!Number.isFinite(waitMinutes) || waitMinutes <= 0) {
      throw new Error(`CHS wait page returned an invalid wait value for ${rawLabel}`);
    }

    const isPrecheck = /tsa pre/i.test(rawLabel);
    const name = isPrecheck ? 'TSA PreCheck' : rawLabel || `Checkpoint ${index + 1}`;

    return {
      id: `chs-${index + 1}`,
      name,
      terminal: 'Main Terminal',
      status: isPrecheck ? 'PreCheck Only' : 'Open',
      waitMinutes,
      displayWait: formatWait(waitMinutes),
      message: isPrecheck ? 'TSA PreCheck lane' : 'General screening',
      source: 'official',
    };
  });
}

export async function fetchChsWaitSnapshot(): Promise<ChsWaitSnapshot> {
  const response = await fetchWithTimeout(CHS_WAIT_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`CHS wait page returned ${response.status}`);
  }

  const html = await response.text();
  const checkpoints = parseCheckpointCards(html);
  const generalEntries = checkpoints.filter(
    (checkpoint) => checkpoint.message === 'General screening' && checkpoint.waitMinutes !== null,
  );
  const aggregatePool =
    generalEntries.length > 0
      ? generalEntries
      : checkpoints.filter((checkpoint) => checkpoint.waitMinutes !== null);
  const waitMinutes =
    aggregatePool.length > 0
      ? Math.max(...aggregatePool.map((checkpoint) => checkpoint.waitMinutes ?? 0))
      : 0;

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay: formatWait(waitMinutes),
    checkpoints,
  };
}
