import type { AirportCheckpoint } from '../../../shared/airport-status';

type MiaWaitApiRecord = {
  airportCode?: string;
  localTime?: string;
  projectedMaxWaitMinutes?: number;
  projectedMinWaitMinutes?: number;
  queueId?: string;
  queueName?: string;
  status?: string;
  time?: string;
};

type MiaWaitApiResponse = {
  current?: MiaWaitApiRecord[];
};

type MiaWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const MIA_WAIT_URL = 'https://waittime.api.aero/waittime/v2/current/MIA';
const MIA_WAIT_API_KEY = '5d0cacea6e41416fdcde0c5c5a19d867';

function parseRecordTime(record: MiaWaitApiRecord): number {
  const value = record.time ?? record.localTime;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildDisplayWait(minMinutes: number, maxMinutes: number): string {
  if (maxMinutes <= 0) {
    return 'Closed';
  }

  if (maxMinutes < 5) {
    return 'Less than 5 min';
  }

  if (minMinutes <= 0 || minMinutes === maxMinutes) {
    return `${maxMinutes} min`;
  }

  return `${minMinutes}-${maxMinutes} min`;
}

function parseQueueName(queueName?: string): { checkpointLabel: string; laneLabel: string } {
  const normalized = queueName?.trim() || 'Main General';
  const match = normalized.match(/^(\d+)\s+(.+)$/);
  if (!match) {
    return {
      checkpointLabel: normalized,
      laneLabel: 'General screening',
    };
  }

  const checkpoint = `Checkpoint ${match[1]}`;
  const rawLane = match[2].trim();
  const laneLabel =
    rawLane.toLowerCase() === 'general'
      ? 'General screening'
      : rawLane.toLowerCase() === 'tsa-pre'
        ? 'TSA PreCheck lane'
        : rawLane.toLowerCase() === 'priority'
          ? 'Priority lane'
          : rawLane.toLowerCase() === 'clear'
            ? 'CLEAR lane'
            : rawLane;

  return {
    checkpointLabel: checkpoint,
    laneLabel,
  };
}

function formatAggregateWait(waitMinutes: number): string {
  if (waitMinutes <= 0) {
    return 'Closed';
  }

  if (waitMinutes < 5) {
    return 'Less than 5 min';
  }

  return `${waitMinutes} min`;
}

export async function fetchMiaWaitSnapshot(): Promise<MiaWaitSnapshot> {
  const response = await fetch(MIA_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.miami-airport.com',
      Referer: 'https://www.miami-airport.com/tsa-waittimes.asp',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
      'x-apikey': MIA_WAIT_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`MIA wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as MiaWaitApiResponse;
  const latestTimestamp = Math.max(...(payload.current ?? []).map(parseRecordTime));
  if (!Number.isFinite(latestTimestamp) || latestTimestamp <= 0) {
    throw new Error('MIA wait API returned no fresh records');
  }

  const freshnessWindowMs = 2 * 60 * 60 * 1000;
  const latestByQueueId = new Map<string, MiaWaitApiRecord>();

  for (const record of payload.current ?? []) {
    const queueKey = record.queueId ?? record.queueName ?? '';
    const recordTimestamp = parseRecordTime(record);
    if (!queueKey || record.airportCode !== 'MIA') {
      continue;
    }

    if (latestTimestamp - recordTimestamp > freshnessWindowMs) {
      continue;
    }

    const previous = latestByQueueId.get(queueKey);
    if (!previous || parseRecordTime(previous) < recordTimestamp) {
      latestByQueueId.set(queueKey, record);
    }
  }

  const checkpoints = [...latestByQueueId.values()]
    .sort((left, right) => (left.queueName ?? '').localeCompare(right.queueName ?? ''))
    .map((record, index): AirportCheckpoint => {
      const minMinutes = Math.max(0, record.projectedMinWaitMinutes ?? 0);
      const maxMinutes = Math.max(minMinutes, record.projectedMaxWaitMinutes ?? 0);
      const isClosed = (record.status ?? '').toLowerCase() === 'closed' || maxMinutes <= 0;
      const { checkpointLabel, laneLabel } = parseQueueName(record.queueName);
      const isPreCheck = laneLabel.toLowerCase().includes('precheck');

      return {
        id: `mia-${record.queueId ?? index + 1}`,
        name: checkpointLabel,
        terminal: checkpointLabel,
        status: isClosed ? 'Closed' : isPreCheck ? 'PreCheck Only' : 'Open',
        waitMinutes: isClosed ? null : maxMinutes,
        displayWait: isClosed ? 'Closed' : buildDisplayWait(minMinutes, maxMinutes),
        message: laneLabel,
        source: 'official',
      };
    });

  if (checkpoints.length === 0) {
    throw new Error('MIA wait API returned zero usable checkpoints');
  }

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
    fetchedAt: new Date(latestTimestamp).toISOString(),
    waitMinutes,
    waitDisplay: formatAggregateWait(waitMinutes),
    checkpoints,
  };
}
