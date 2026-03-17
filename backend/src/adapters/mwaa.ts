import type { AirportCheckpoint } from '../../../shared/airport-status';

type MwaaWaitResponse = {
  response?: {
    isMulti?: boolean;
    res?: Record<
      string,
      {
        location?: string;
        gates?: string;
        waittime?: string;
        isDisabled?: number;
        pre?: string;
        pre_disabled?: number;
        url?: string;
      }
    >;
  };
};

type MwaaWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

function waitTextToMinutes(waitText?: string): number | null {
  if (!waitText) {
    return null;
  }

  const normalized = waitText.trim().toLowerCase();
  if (!normalized || normalized === 'closed') {
    return null;
  }

  const lessThan = normalized.match(/<\s*(\d+)/);
  if (lessThan) {
    return Math.max(1, Number(lessThan[1]) - 1);
  }

  const range = normalized.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    return Number(range[2]);
  }

  const direct = normalized.match(/(\d+)/);
  return direct ? Number(direct[1]) : null;
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

async function fetchMwaaWaitSnapshot(url: string, prefix: string): Promise<MwaaWaitSnapshot> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`${prefix} wait endpoint returned ${response.status}`);
  }

  const payload = (await response.json()) as MwaaWaitResponse;
  const records = Object.entries(payload.response?.res ?? {});
  if (records.length === 0) {
    throw new Error(`${prefix} wait endpoint returned zero checkpoints`);
  }

  const checkpoints: AirportCheckpoint[] = [];

  for (const [id, entry] of records) {
    const location = [entry.location?.trim(), entry.gates?.trim()].filter(Boolean).join(' ');
    const generalMinutes = waitTextToMinutes(entry.waittime);

    checkpoints.push({
      id: `${prefix.toLowerCase()}-${id.toLowerCase()}-general`,
      name: location || 'Main checkpoint',
      terminal: entry.location?.trim() || 'Main',
      status: entry.isDisabled === 1 || generalMinutes === null ? 'Closed' : 'Open',
      waitMinutes: generalMinutes,
      displayWait: entry.isDisabled === 1 || !entry.waittime ? 'Closed' : entry.waittime.trim(),
      message: 'General screening',
      source: 'official',
    });

    if (entry.pre || entry.pre_disabled === 0) {
      const preMinutes = waitTextToMinutes(entry.pre);
      checkpoints.push({
        id: `${prefix.toLowerCase()}-${id.toLowerCase()}-precheck`,
        name: `${location || 'Main checkpoint'} PreCheck`,
        terminal: entry.location?.trim() || 'Main',
        status: entry.pre_disabled === 1 || preMinutes === null ? 'Closed' : 'PreCheck Only',
        waitMinutes: preMinutes,
        displayWait: entry.pre_disabled === 1 || !entry.pre ? 'Closed' : entry.pre.trim(),
        message: 'TSA PreCheck lane',
        source: 'official',
      });
    }
  }

  const openGeneral = checkpoints.filter(
    (checkpoint) => checkpoint.message === 'General screening' && checkpoint.waitMinutes !== null,
  );
  const openAny = checkpoints.filter((checkpoint) => checkpoint.waitMinutes !== null);
  const aggregatePool = openGeneral.length > 0 ? openGeneral : openAny;
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

export function fetchDcaWaitSnapshot(): Promise<MwaaWaitSnapshot> {
  return fetchMwaaWaitSnapshot('https://www.flyreagan.com/security-wait-times', 'DCA');
}

export function fetchIadWaitSnapshot(): Promise<MwaaWaitSnapshot> {
  return fetchMwaaWaitSnapshot('https://www.flydulles.com/security-wait-times', 'IAD');
}
