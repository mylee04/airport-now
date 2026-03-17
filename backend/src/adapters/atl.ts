import type { AirportCheckpoint } from '../../../shared/airport-status';

type AtlWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const ATL_WAIT_URL = 'https://dev.atl.com/atlsync/security-wait-times/';

function waitTextToMinutes(waitText: string): number | null {
  const normalized = waitText.trim().toLowerCase();

  if (!normalized || normalized === 'closed') {
    return null;
  }

  const direct = normalized.match(/(\d+)/);
  return direct ? Number(direct[1]) : null;
}

function formatAggregateWait(waitMinutes: number): string {
  if (waitMinutes <= 0) {
    return 'Closed';
  }

  if (waitMinutes === 1) {
    return '1 min';
  }

  return `${waitMinutes} min`;
}

function normalizeCheckpointName(rawName: string): string {
  const normalized = rawName.trim().replace(/\s+/g, ' ');
  return normalized.toLowerCase().endsWith('checkpoint') ? normalized : `${normalized} Checkpoint`;
}

export async function fetchAtlWaitSnapshot(): Promise<AtlWaitSnapshot> {
  const response = await fetch(ATL_WAIT_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`ATL wait page returned ${response.status}`);
  }

  const html = await response.text();
  const matches = [
    ...html.matchAll(
      /<h2 class="elementor-heading-title elementor-size-default">([^<]+)<\/h2>\s*<\/div>\s*<div[^>]*>\s*<h2 class="elementor-heading-title elementor-size-default">CHECKPOINT<\/h2>[\s\S]*?<text x="50%" y="70%" text-anchor="middle" font-size="30" fill="#000">([^<]+)<\/text>[\s\S]*?<p style="font-size: 14px;">Last updated\s*([^<]+)<\/p>/g,
    ),
  ];

  const checkpoints = matches.map((match, index): AirportCheckpoint => {
    const checkpointName = normalizeCheckpointName(match[1] ?? 'Main');
    const displayWait = (match[2] ?? '').trim();
    const waitMinutes = waitTextToMinutes(displayWait);

    return {
      id: `atl-${index + 1}`,
      name: checkpointName,
      terminal: checkpointName,
      status: waitMinutes === null ? 'Closed' : 'Open',
      waitMinutes,
      displayWait: waitMinutes === null ? 'Closed' : displayWait,
      message: 'General screening',
      source: 'official',
    };
  });

  if (checkpoints.length === 0) {
    throw new Error('ATL wait page parsed zero checkpoints');
  }

  const openCheckpoints = checkpoints.filter((checkpoint) => checkpoint.waitMinutes !== null);
  const aggregatePool = openCheckpoints.length > 0 ? openCheckpoints : checkpoints;
  const waitMinutes = aggregatePool.length > 0
    ? Math.max(...aggregatePool.map((checkpoint) => checkpoint.waitMinutes ?? 0))
    : 0;

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay: formatAggregateWait(waitMinutes),
    checkpoints,
  };
}
