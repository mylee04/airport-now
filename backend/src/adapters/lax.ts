import type { AirportCheckpoint } from '../../../shared/airport-status';

type LaxWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const LAX_URL = 'https://www.flylax.com/wait-times';

function waitTextToMinutes(waitText: string): number {
  const normalized = waitText.toLowerCase().trim();
  const direct = normalized.match(/(\d+)/);
  return direct ? Number(direct[1]) : 0;
}

function formatAggregateWait(waitMinutes: number): string {
  if (waitMinutes <= 0) {
    return 'Closed';
  }

  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

export async function fetchLaxWaitSnapshot(): Promise<LaxWaitSnapshot> {
  const response = await fetch(LAX_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`LAX wait page returned ${response.status}`);
  }

  const html = await response.text();
  const rows = [...html.matchAll(
    /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/g,
  )];

  const checkpoints = rows.map((match, index): AirportCheckpoint => {
    const terminal = match[1].trim();
    const boardingType = match[2].trim();
    const displayWait = match[3].trim();
    const waitMinutes = waitTextToMinutes(displayWait);
    const isPreCheck = boardingType.toLowerCase().includes('pre');

    return {
      id: `lax-${index + 1}`,
      name: terminal,
      terminal,
      status: isPreCheck ? 'PreCheck Only' : 'Open',
      waitMinutes,
      displayWait,
      message: boardingType,
      source: 'official',
    };
  });

  if (checkpoints.length === 0) {
    throw new Error('LAX wait page parsed zero checkpoints');
  }

  const generalEntries = checkpoints.filter((checkpoint) => checkpoint.message.toLowerCase().includes('general'));
  const aggregatePool = generalEntries.length > 0 ? generalEntries : checkpoints;
  const waitMinutes = Math.max(...aggregatePool.map((checkpoint) => checkpoint.waitMinutes ?? 0));
  const timestampText = html.match(/<div>\s*Data Last Updated:\s*<\/div>\s*<div>([^<]+)<\/div>/)?.[1]?.trim();

  return {
    fetchedAt: timestampText ? new Date(timestampText).toISOString() : new Date().toISOString(),
    waitMinutes,
    waitDisplay: formatAggregateWait(waitMinutes),
    checkpoints,
  };
}
