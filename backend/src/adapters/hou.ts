import type { AirportCheckpoint } from '../../../shared/airport-status';
import { fetchWithTimeout } from './shared-upstream';

type HouWaitRow = {
  id?: string;
  name?: string;
  isOpen?: boolean;
  isDisplayable?: boolean;
  waitSeconds?: number;
  attributes?: string[];
};

type HouWaitPayload = {
  data?: {
    wait_times?: HouWaitRow[];
  };
};

type HouWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const HOU_WAIT_URL = 'https://api.houstonairports.mobi/wait-times/checkpoint/hou';
const HOU_REFERER = 'https://www.fly2houston.com/hou/security/';
const HOU_API_KEY = '9ACB3B733BE94B11A03B6E84CA87E895';
const HOU_API_VERSION = '120';

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function isPrecheckRow(row: HouWaitRow): boolean {
  return /pre[-\s]?check/i.test(row.name ?? '') || (row.id ?? '').toUpperCase().endsWith('PC');
}

export async function fetchHouWaitSnapshot(): Promise<HouWaitSnapshot> {
  const response = await fetchWithTimeout(HOU_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Api-Key': HOU_API_KEY,
      'Api-Version': HOU_API_VERSION,
      Referer: HOU_REFERER,
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`HOU wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as HouWaitPayload;
  const rows = (payload.data?.wait_times ?? []).filter((row) => {
    if (row.isDisplayable !== true) {
      return false;
    }

    const attributes = row.attributes ?? [];
    return !attributes.includes('fis');
  });

  const checkpoints = rows.map((row, index): AirportCheckpoint => {
    const isPrecheck = isPrecheckRow(row);
    const waitMinutes = row.isOpen ? Math.max(0, Math.ceil((row.waitSeconds ?? 0) / 60)) : null;

    return {
      id: `hou-${row.id ?? index + 1}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      name: row.name?.trim() || `Checkpoint ${index + 1}`,
      terminal: 'Main Terminal',
      status: waitMinutes === null ? 'Closed' : isPrecheck ? 'PreCheck Only' : 'Open',
      waitMinutes,
      displayWait: waitMinutes === null ? 'Closed' : formatWait(waitMinutes),
      message: isPrecheck ? 'TSA PreCheck lane' : 'General screening',
      source: 'official',
    };
  });

  if (checkpoints.length === 0) {
    throw new Error('HOU wait API returned zero usable checkpoints');
  }

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
