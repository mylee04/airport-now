import type { AirportCheckpoint } from '../../../shared/airport-status';

type PdxWaitTime = {
  CounterId?: number;
  CounterName?: string;
  DisplayText?: string;
};

type PdxWaitApiResponse = {
  WaitTimes?: PdxWaitTime[];
  NorthCheckpointClosed?: boolean;
  SouthCheckpointClosed?: boolean;
};

type PdxWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const PDX_WAIT_URL = 'https://www.pdx.com/TSAWaitTimesRefresh';

function waitTextToMinutes(waitText?: string): number {
  const value = Number(waitText ?? '');
  return Number.isFinite(value) ? Math.max(0, value) : 0;
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

function describeCheckpoint(counterName?: string): {
  checkpointLabel: string;
  terminal: string;
  laneLabel: string;
  checkpointKey: 'north' | 'south';
} {
  const normalized = counterName?.trim() || '';
  const isNorth = normalized.toLowerCase().startsWith('north');
  const checkpointKey = isNorth ? 'north' : 'south';

  return {
    checkpointLabel: isNorth ? 'Security Checkpoint D E' : 'Security Checkpoint B C',
    terminal: isNorth ? 'Concourse D/E' : 'Concourse B/C',
    laneLabel: normalized.toLowerCase().includes('precheck') ? 'TSA PreCheck lane' : 'General screening',
    checkpointKey,
  };
}

export async function fetchPdxWaitSnapshot(): Promise<PdxWaitSnapshot> {
  const response = await fetch(PDX_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`PDX wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as PdxWaitApiResponse;
  const rawEntries = payload.WaitTimes ?? [];
  if (rawEntries.length === 0) {
    throw new Error('PDX wait API returned zero checkpoints');
  }

  const checkpoints = rawEntries.map((entry, index): AirportCheckpoint => {
    const waitMinutes = waitTextToMinutes(entry.DisplayText);
    const { checkpointLabel, terminal, laneLabel, checkpointKey } = describeCheckpoint(entry.CounterName);
    const checkpointClosed = checkpointKey === 'north' ? payload.NorthCheckpointClosed : payload.SouthCheckpointClosed;
    const isClosed = checkpointClosed === true;

    return {
      id: `pdx-${entry.CounterId ?? index + 1}`,
      name: checkpointLabel,
      terminal,
      status: isClosed ? 'Closed' : laneLabel === 'TSA PreCheck lane' ? 'PreCheck Only' : 'Open',
      waitMinutes: isClosed ? null : waitMinutes,
      displayWait: isClosed ? 'Closed' : formatAggregateWait(waitMinutes),
      message: laneLabel,
      source: 'official',
    };
  });

  const generalEntries = checkpoints.filter(
    (checkpoint) => checkpoint.message === 'General screening' && checkpoint.waitMinutes !== null,
  );
  const aggregatePool = generalEntries.length > 0
    ? generalEntries
    : checkpoints.filter((checkpoint) => checkpoint.waitMinutes !== null);
  const waitMinutes =
    aggregatePool.length > 0
      ? Math.max(...aggregatePool.map((checkpoint) => checkpoint.waitMinutes ?? 0))
      : 0;

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay: formatAggregateWait(waitMinutes),
    checkpoints,
  };
}
