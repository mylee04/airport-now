import type { AirportCheckpoint } from '../../../shared/airport-status';

type DfwWaitApiEntry = {
  id: string;
  lane: string;
  name: string;
  isOpen: boolean;
  isDisplayable: boolean;
  waitSeconds: number;
  lastUpdatedTimestamp: number;
};

type DfwWaitApiResponse = {
  data?: {
    wait_times?: DfwWaitApiEntry[];
  };
  status?: {
    code?: number;
    message?: string;
  };
};

type DfwWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const DFW_URL = 'https://api.dfwairport.mobi/wait-times/checkpoint/DFW';
const DFW_API_KEY = '87856E0636AA4BF282150FCBE1AD63DE';
const DFW_API_VERSION = '170';

function waitSecondsToMinutes(waitSeconds: number): number {
  return Math.max(1, Math.ceil(waitSeconds / 60));
}

function waitSecondsToDisplay(waitSeconds: number): string {
  if (waitSeconds < 600) {
    return 'Less than 10 min';
  }

  return `${waitSecondsToMinutes(waitSeconds)} min`;
}

function laneMessage(lane: string): string {
  const normalized = lane.toLowerCase();

  if (normalized === 'general') {
    return 'Standard screening';
  }

  if (normalized.includes('pre')) {
    return 'TSA PreCheck lane';
  }

  if (normalized.includes('priority')) {
    return 'Priority lane';
  }

  return lane;
}

function terminalForCheckpoint(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter ? `Terminal ${letter}` : 'Main';
}

function sortValue(checkpoint: AirportCheckpoint): string {
  return `${checkpoint.terminal}-${checkpoint.name}-${checkpoint.message}`;
}

export async function fetchDfwWaitSnapshot(): Promise<DfwWaitSnapshot> {
  const response = await fetch(DFW_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://www.dfwairport.com/',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
      'api-key': DFW_API_KEY,
      'api-version': DFW_API_VERSION,
    },
  });

  if (!response.ok) {
    throw new Error(`DFW wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as DfwWaitApiResponse;
  if (payload.status?.code !== 200) {
    throw new Error(payload.status?.message || 'DFW wait API returned a non-200 status');
  }

  const visibleEntries = (payload.data?.wait_times ?? []).filter((entry) => entry.isDisplayable);
  const checkpoints = visibleEntries
    .map((entry): AirportCheckpoint => {
      const lane = entry.lane.trim();
      const isPreCheck = lane.toLowerCase().includes('pre');
      const waitMinutes = entry.isOpen ? waitSecondsToMinutes(entry.waitSeconds) : null;

      return {
        id: `dfw-${entry.id}`,
        name: `Checkpoint ${entry.name}`,
        terminal: terminalForCheckpoint(entry.name),
        status: !entry.isOpen ? 'Closed' : isPreCheck ? 'PreCheck Only' : 'Open',
        waitMinutes,
        displayWait: !entry.isOpen ? 'Closed' : waitSecondsToDisplay(entry.waitSeconds),
        message: laneMessage(lane),
        source: 'official',
      };
    })
    .sort((left, right) => sortValue(left).localeCompare(sortValue(right)));

  if (checkpoints.length === 0) {
    throw new Error('DFW wait API returned zero displayable checkpoints');
  }

  const generalOpenEntries = visibleEntries.filter(
    (entry) => entry.isOpen && entry.lane.trim().toLowerCase() === 'general',
  );
  const openEntries = visibleEntries.filter((entry) => entry.isOpen);
  const aggregateEntries = generalOpenEntries.length > 0 ? generalOpenEntries : openEntries;
  const aggregateWaitSeconds = aggregateEntries.length > 0 ? Math.max(...aggregateEntries.map((entry) => entry.waitSeconds)) : 0;
  const latestTimestamp = Math.max(...visibleEntries.map((entry) => entry.lastUpdatedTimestamp));

  return {
    fetchedAt: latestTimestamp > 0 ? new Date(latestTimestamp * 1000).toISOString() : new Date().toISOString(),
    waitMinutes: aggregateWaitSeconds > 0 ? waitSecondsToMinutes(aggregateWaitSeconds) : 0,
    waitDisplay: aggregateWaitSeconds > 0 ? waitSecondsToDisplay(aggregateWaitSeconds) : 'Closed',
    checkpoints,
  };
}
