import type { AirportCheckpoint } from '../../../shared/airport-status';
import { fetchWithTimeout } from './shared-upstream';

type McoWaitRow = {
  id?: string;
  lane?: string;
  name?: string;
  isOpen?: boolean;
  isDisplayable?: boolean;
  waitSeconds?: number;
  attributes?: {
    minGate?: string;
    maxGate?: string;
  };
};

type McoWaitPayload = {
  data?: {
    wait_times?: McoWaitRow[];
  };
};

type McoWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const MCO_WAIT_URL = 'https://api.goaa.aero/wait-times/checkpoint/MCO';
const MCO_REFERER = 'https://flymco.com/';
const MCO_API_KEY = '8eaac7209c824616a8fe58d22268cd59';
const MCO_API_VERSION = '140';

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function checkpointLabel(row: McoWaitRow, index: number): string {
  const minGate = row.attributes?.minGate;
  const maxGate = row.attributes?.maxGate;
  if (minGate && maxGate) {
    return `Gates ${minGate}-${maxGate}`;
  }

  return row.name?.replace(/\s+(Standard|PreCheck)$/i, '').trim() || `Checkpoint ${index + 1}`;
}

export async function fetchMcoWaitSnapshot(): Promise<McoWaitSnapshot> {
  const response = await fetchWithTimeout(MCO_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Api-Key': MCO_API_KEY,
      'Api-Version': MCO_API_VERSION,
      Referer: MCO_REFERER,
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`MCO wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as McoWaitPayload;
  const rows = (payload.data?.wait_times ?? []).filter((row) => row.isDisplayable === true);
  const checkpoints = rows.map((row, index): AirportCheckpoint => {
    const isPrecheck = (row.lane ?? '').trim().toLowerCase() === 'precheck';
    const waitMinutes = row.isOpen ? Math.max(0, Math.ceil((row.waitSeconds ?? 0) / 60)) : null;
    const label = checkpointLabel(row, index);

    return {
      id: `mco-${row.id ?? index + 1}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      name: label,
      terminal: label,
      status: waitMinutes === null ? 'Closed' : isPrecheck ? 'PreCheck Only' : 'Open',
      waitMinutes,
      displayWait: waitMinutes === null ? 'Closed' : formatWait(waitMinutes),
      message: isPrecheck ? 'TSA PreCheck lane' : 'General screening',
      source: 'official',
    };
  });

  if (checkpoints.length === 0) {
    throw new Error('MCO wait API returned zero usable checkpoints');
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
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay: formatWait(waitMinutes),
    checkpoints,
  };
}
