import type { AirportCheckpoint } from '../../../shared/airport-status';

type PhxWaitApiRecord = {
  airportCode?: string;
  localTime?: string;
  projectedMaxWaitMinutes?: number;
  projectedMinWaitMinutes?: number;
  queueId?: string;
  queueName?: string;
  status?: string;
  time?: string;
};

type PhxWaitApiResponse = {
  current?: PhxWaitApiRecord[];
};

type PhxWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const PHX_WAIT_URL = 'https://api.phx.aero/avn-wait-times/raw?Key=4f85fe2ef5a240d59809b63de94ef536';

function parseRecordTime(record: PhxWaitApiRecord): number {
  const value = record.time ?? record.localTime;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildDisplayWait(minMinutes: number, maxMinutes: number): string {
  if (maxMinutes <= 0) {
    return 'Closed';
  }

  if (maxMinutes < 10) {
    return 'Less than 10 min';
  }

  if (minMinutes <= 0 || minMinutes === maxMinutes) {
    return `${maxMinutes} min`;
  }

  return `${minMinutes}-${maxMinutes} min`;
}

function parseQueueName(queueName?: string): {
  checkpointLabel: string;
  terminal: string;
  laneLabel: string;
} {
  const normalized = queueName?.trim() || 'Main General';
  const t4Match = normalized.match(/^T(\d+)\s+Checkpoint\s+([A-Z])\s+(.+)$/i);
  if (t4Match) {
    return {
      checkpointLabel: `Checkpoint ${t4Match[2].toUpperCase()}`,
      terminal: `Terminal ${t4Match[1]}`,
      laneLabel: t4Match[3].trim(),
    };
  }

  const terminalMatch = normalized.match(/^T(\d+)\s+(.+)$/i);
  if (terminalMatch) {
    return {
      checkpointLabel: `Terminal ${terminalMatch[1]}`,
      terminal: `Terminal ${terminalMatch[1]}`,
      laneLabel: terminalMatch[2].trim(),
    };
  }

  return {
    checkpointLabel: normalized,
    terminal: normalized,
    laneLabel: 'General',
  };
}

function describeLane(laneLabel: string): string {
  const normalized = laneLabel.toLowerCase();
  if (normalized.includes('pre')) {
    return 'TSA PreCheck lane';
  }

  if (normalized.includes('clear')) {
    return 'CLEAR lane';
  }

  if (normalized.includes('priority')) {
    return 'Priority lane';
  }

  return 'General screening';
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

export async function fetchPhxWaitSnapshot(): Promise<PhxWaitSnapshot> {
  const response = await fetch(PHX_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`PHX wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as PhxWaitApiResponse;
  const latestTimestamp = Math.max(...(payload.current ?? []).map(parseRecordTime));
  if (!Number.isFinite(latestTimestamp) || latestTimestamp <= 0) {
    throw new Error('PHX wait API returned no fresh records');
  }

  const freshnessWindowMs = 2 * 60 * 60 * 1000;
  const latestByQueueId = new Map<string, PhxWaitApiRecord>();

  for (const record of payload.current ?? []) {
    const queueKey = record.queueId ?? record.queueName ?? '';
    const recordTimestamp = parseRecordTime(record);
    if (!queueKey || record.airportCode !== 'PHX') {
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
      const { checkpointLabel, terminal, laneLabel } = parseQueueName(record.queueName);
      const message = describeLane(laneLabel);
      const isClosed = (record.status ?? '').toLowerCase() === 'closed' || maxMinutes <= 0;

      return {
        id: `phx-${record.queueId ?? index + 1}`,
        name: checkpointLabel,
        terminal,
        status: isClosed ? 'Closed' : message === 'TSA PreCheck lane' ? 'PreCheck Only' : 'Open',
        waitMinutes: isClosed ? null : maxMinutes,
        displayWait: isClosed ? 'Closed' : buildDisplayWait(minMinutes, maxMinutes),
        message,
        source: 'official',
      };
    });

  if (checkpoints.length === 0) {
    throw new Error('PHX wait API returned zero usable checkpoints');
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
