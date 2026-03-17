import type { AirportCheckpoint } from '../../../shared/airport-status';

type CleWaitPayload = Array<{
  field_json?: {
    a?: string;
    b?: string;
    c?: string;
    apre?: boolean;
    bpre?: boolean;
    cpre?: boolean;
  };
}>;

type CleWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const CLE_WAIT_URL = 'https://www.clevelandairport.com/tsa-wait-times-api';

const CLE_CHECKPOINTS: Array<{
  key: 'a' | 'b' | 'c';
  name: string;
  precheckKey: 'apre' | 'bpre' | 'cpre';
}> = [
  { key: 'a', name: 'Checkpoint A', precheckKey: 'apre' },
  { key: 'b', name: 'Checkpoint B', precheckKey: 'bpre' },
  { key: 'c', name: 'Checkpoint C', precheckKey: 'cpre' },
];

function levelToMinutes(level?: string): number | null {
  switch ((level ?? '').trim().toLowerCase()) {
    case 'low':
      return 7;
    case 'medium':
      return 18;
    case 'high':
      return 32;
    case 'severe':
      return 45;
    case 'closed':
      return null;
    default:
      return 0;
  }
}

function levelToDisplay(level?: string): string {
  switch ((level ?? '').trim().toLowerCase()) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
    case 'severe':
      return 'Severe';
    case 'closed':
      return 'Closed';
    default:
      return 'Unknown';
  }
}

function aggregateDisplay(checkpoints: AirportCheckpoint[]): string {
  const ranked = checkpoints
    .map((checkpoint) => checkpoint.displayWait)
    .find((display) => display === 'Severe')
    ?? checkpoints.map((checkpoint) => checkpoint.displayWait).find((display) => display === 'High')
    ?? checkpoints.map((checkpoint) => checkpoint.displayWait).find((display) => display === 'Medium')
    ?? checkpoints.map((checkpoint) => checkpoint.displayWait).find((display) => display === 'Low');

  return ranked ?? 'Unknown';
}

export async function fetchCleWaitSnapshot(): Promise<CleWaitSnapshot> {
  const response = await fetch(CLE_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`CLE wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as CleWaitPayload;
  const waitField = payload[0]?.field_json;
  if (!waitField) {
    throw new Error('CLE wait API returned no field_json payload');
  }

  const checkpoints = CLE_CHECKPOINTS.map((definition): AirportCheckpoint => {
    const level = waitField[definition.key];
    const waitMinutes = levelToMinutes(level);
    const hasPrecheck = waitField[definition.precheckKey] === true;

    return {
      id: `cle-${definition.key}`,
      name: definition.name,
      terminal: 'Main Terminal',
      status: waitMinutes === null ? 'Closed' : 'Open',
      waitMinutes,
      displayWait: levelToDisplay(level),
      message: hasPrecheck ? 'General screening with TSA PreCheck available' : 'General screening',
      source: 'official',
    };
  });

  const openCheckpoints = checkpoints.filter((checkpoint) => checkpoint.waitMinutes !== null);
  if (openCheckpoints.length === 0) {
    throw new Error('CLE wait API returned zero usable checkpoints');
  }

  const waitMinutes = Math.max(...openCheckpoints.map((checkpoint) => checkpoint.waitMinutes ?? 0));

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay: aggregateDisplay(openCheckpoints),
    checkpoints,
  };
}
