import type { AirportCheckpoint } from '../../../shared/airport-status';
import { fetchWithTimeout } from './shared-upstream';

type CvgWaitApiCheckpoint = {
  id?: string;
  lane?: string;
  name?: string;
  isOpen?: boolean;
  waitSeconds?: number;
};

type CvgWaitPayload = {
  data?: {
    checkpoints?: CvgWaitApiCheckpoint[];
  };
};

type CvgWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const CVG_WAIT_URL = 'https://api.cvgairport.mobi/checkpoints/CVG';
const CVG_REFERER = 'https://www.cvgairport.com/';
const CVG_API_KEY = 'b6461a439f1047ac950a920866b86fef';
const CVG_API_VERSION = '100';

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

export async function fetchCvgWaitSnapshot(): Promise<CvgWaitSnapshot> {
  const response = await fetchWithTimeout(CVG_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Api-Key': CVG_API_KEY,
      'Api-Version': CVG_API_VERSION,
      Referer: CVG_REFERER,
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`CVG wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as CvgWaitPayload;
  const rows = payload.data?.checkpoints ?? [];
  const checkpoints = rows.map((row, index): AirportCheckpoint => {
    const isPrecheck = (row.lane ?? '').trim().toLowerCase() === 'pre';
    const waitMinutes = row.isOpen ? Math.max(0, Math.ceil((row.waitSeconds ?? 0) / 60)) : null;

    return {
      id: `cvg-${row.id ?? index + 1}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      name: 'Main Security',
      terminal: 'Main Terminal',
      status: waitMinutes === null ? 'Closed' : isPrecheck ? 'PreCheck Only' : 'Open',
      waitMinutes,
      displayWait: waitMinutes === null ? 'Closed' : formatWait(waitMinutes),
      message: isPrecheck ? 'TSA PreCheck lane' : 'General screening',
      source: 'official',
    };
  });

  if (checkpoints.length === 0) {
    throw new Error('CVG wait API returned zero usable checkpoints');
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
