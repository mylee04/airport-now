import type { AirportCheckpoint } from '../../../shared/airport-status';

type DenWaitLane = {
  lane_id: string;
  title: string;
  closed: boolean;
  wait_time: string;
  opening_info: string;
  hide_lane: boolean;
};

type DenWaitEntry = {
  title: string;
  location?: string;
  lanes?: DenWaitLane[];
};

type DenWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const DEN_WAIT_URL = 'https://app.flyfruition.com/api/public/tsa';
const DEN_WAIT_REFERER = 'https://www.flydenver.com/security/';
const DEN_API_KEY = 'vqw8ruvwqpv02pqu938bh5p028';

function parseWaitRange(waitText: string): { min: number; max: number } | null {
  const trimmed = waitText.trim();
  if (!trimmed) {
    return null;
  }

  const rangeMatch = trimmed.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    return {
      min: Number(rangeMatch[1]),
      max: Number(rangeMatch[2]),
    };
  }

  const singleMatch = trimmed.match(/(\d+)/);
  if (!singleMatch) {
    return null;
  }

  const minutes = Number(singleMatch[1]);
  return {
    min: minutes,
    max: minutes,
  };
}

function displayWait(waitText: string): string {
  const range = parseWaitRange(waitText);
  if (!range) {
    return waitText.trim() || 'Unknown';
  }

  if (range.min === range.max) {
    return `${range.max} min`;
  }

  return `${range.min}-${range.max} min`;
}

function laneMessage(laneTitle: string): string {
  const normalized = laneTitle.toLowerCase();
  if (normalized.includes('clear')) {
    return 'CLEAR lane';
  }

  if (normalized.includes('pre')) {
    return 'TSA PreCheck lane';
  }

  return 'Standard screening';
}

function checkpointStatus(lane: DenWaitLane): AirportCheckpoint['status'] {
  if (lane.closed) {
    return 'Closed';
  }

  return lane.title.toLowerCase().includes('pre') ? 'PreCheck Only' : 'Open';
}

export async function fetchDenWaitSnapshot(): Promise<DenWaitSnapshot> {
  const response = await fetch(DEN_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: DEN_WAIT_REFERER,
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
      'x-api-key': DEN_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`DEN wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as DenWaitEntry[];
  const visibleLanes = payload.flatMap((entry) =>
    (entry.lanes ?? [])
      .filter((lane) => !lane.hide_lane)
      .map((lane) => ({ entry, lane })),
  );

  if (visibleLanes.length === 0) {
    throw new Error('DEN wait API returned zero visible lanes');
  }

  const checkpoints = visibleLanes.map(({ entry, lane }, index): AirportCheckpoint => {
    const range = parseWaitRange(lane.wait_time);

    return {
      id: `den-${index + 1}-${lane.lane_id}`,
      name: entry.title.trim(),
      terminal: entry.location?.trim() || entry.title.trim(),
      status: checkpointStatus(lane),
      waitMinutes: lane.closed ? null : range?.max ?? null,
      displayWait: lane.closed ? 'Closed' : displayWait(lane.wait_time),
      message: laneMessage(lane.title),
      source: 'official',
    };
  });

  const standardOpenLanes = visibleLanes.filter(
    ({ lane }) => !lane.closed && lane.title.trim().toLowerCase() === 'standard',
  );
  const openLanes = visibleLanes.filter(({ lane }) => !lane.closed);
  const aggregateLanes = standardOpenLanes.length > 0 ? standardOpenLanes : openLanes;
  const aggregateWaitMinutes = aggregateLanes.reduce((maxWait, { lane }) => {
    const range = parseWaitRange(lane.wait_time);
    return Math.max(maxWait, range?.max ?? 0);
  }, 0);

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes: aggregateWaitMinutes,
    waitDisplay: aggregateWaitMinutes > 0 ? `${aggregateWaitMinutes} min` : 'Closed',
    checkpoints,
  };
}
