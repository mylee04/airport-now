import type { AirportCheckpoint } from '../../../shared/airport-status';

type CltWaitApiEntry = {
  id: string;
  name: string;
  isOpen: boolean;
  isDisplayable: boolean;
  waitSeconds: number;
  lastUpdatedTimestamp: number;
  attributes?: {
    general?: boolean;
    preCheck?: boolean;
  };
};

type CltWaitApiResponse = {
  data?: {
    wait_times?: CltWaitApiEntry[];
  };
  status?: {
    code?: number;
    message?: string;
  };
};

type CltWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const CLT_URL = 'https://api.cltairport.mobi/wait-times/checkpoint/CLT';
const CLT_API_KEY = '5ccb418715f9428ca6cb4df1635d4815';
const CLT_API_VERSION = '130';

function waitSecondsToMinutes(waitSeconds: number): number {
  return Math.max(1, Math.ceil(waitSeconds / 60));
}

function waitSecondsToDisplay(waitSeconds: number): string {
  if (waitSeconds < 600) {
    return 'Less than 10 min';
  }

  return `${waitSecondsToMinutes(waitSeconds)} min`;
}

function checkpointSortValue(checkpoint: AirportCheckpoint): string {
  const statusOrder = checkpoint.status === 'PreCheck Only' ? 'z' : 'a';
  return `${checkpoint.name}-${statusOrder}`;
}

export async function fetchCltWaitSnapshot(): Promise<CltWaitSnapshot> {
  const response = await fetch(CLT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://www.cltairport.com/',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
      'api-key': CLT_API_KEY,
      'api-version': CLT_API_VERSION,
    },
  });

  if (!response.ok) {
    throw new Error(`CLT wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as CltWaitApiResponse;
  if (payload.status?.code !== 200) {
    throw new Error(payload.status?.message || 'CLT wait API returned a non-200 status');
  }

  const rawEntries = payload.data?.wait_times ?? [];
  const visibleEntries = rawEntries.filter((entry) => entry.isDisplayable);

  const checkpoints = visibleEntries
    .map((entry): AirportCheckpoint => {
      const isPreCheck = Boolean(entry.attributes?.preCheck);
      const waitMinutes = entry.isOpen ? waitSecondsToMinutes(entry.waitSeconds) : null;

      return {
        id: `clt-${entry.id}`,
        name: entry.name,
        terminal: 'Main',
        status: !entry.isOpen ? 'Closed' : isPreCheck ? 'PreCheck Only' : 'Open',
        waitMinutes,
        displayWait: !entry.isOpen ? 'Closed' : waitSecondsToDisplay(entry.waitSeconds),
        message: isPreCheck ? 'TSA PreCheck lane' : 'Standard screening',
        source: 'official',
      };
    })
    .sort((left, right) => checkpointSortValue(left).localeCompare(checkpointSortValue(right)));

  if (checkpoints.length === 0) {
    throw new Error('CLT wait API returned zero displayable checkpoints');
  }

  const openCheckpoints = checkpoints.filter((checkpoint) => checkpoint.waitMinutes !== null);
  const waitMinutes =
    openCheckpoints.length > 0
      ? Math.max(...openCheckpoints.map((checkpoint) => checkpoint.waitMinutes ?? 0))
      : 0;
  const latestTimestamp = Math.max(...visibleEntries.map((entry) => entry.lastUpdatedTimestamp));

  return {
    fetchedAt: latestTimestamp > 0 ? new Date(latestTimestamp * 1000).toISOString() : new Date().toISOString(),
    waitMinutes,
    waitDisplay: waitMinutes > 0 ? waitSecondsToDisplay(waitMinutes * 60) : 'Closed',
    checkpoints,
  };
}
