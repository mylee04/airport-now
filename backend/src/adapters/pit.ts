import type { AirportCheckpoint } from '../../../shared/airport-status';
import { createTimedCache, fetchWithTimeout, getFreshCacheValue, type TimedCache } from './shared-upstream';

type PitWaitApiEntry = {
  canDisplayData?: boolean;
  checkpointId?: string;
  checkpointName?: string;
  queueId?: string;
  queueName?: string;
  status?: string;
  waitTime?: number;
};

type PitWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const PIT_SECURITY_PAGE_URL = 'https://flypittsburgh.com/pittsburgh-international-airport/security/';
const PIT_CONFIG_CACHE_MS = 30 * 60_000;

let pitConfigCache: TimedCache<{ endpoint: string; subscriptionKey: string }> | null = null;

function formatWait(waitMinutes: number): string {
  if (waitMinutes <= 0) {
    return 'Closed';
  }

  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function normalizeWaitMinutes(entry: PitWaitApiEntry): number | null {
  const isOpen = (entry.status ?? '').trim().toLowerCase() === 'open';
  if (!isOpen) {
    return null;
  }

  return Math.max(1, Math.round(entry.waitTime ?? 0));
}

function describeLane(entry: PitWaitApiEntry): {
  laneKey: string;
  message: string;
  status: AirportCheckpoint['status'];
} {
  switch (entry.queueId) {
    case 'TMP_PreCheck':
      return {
        laneKey: 'precheck',
        message: 'TSA PreCheck lane',
        status: 'PreCheck Only',
      };
    case 'TMP_CLEAR':
      return {
        laneKey: 'clear',
        message: 'CLEAR lane',
        status: 'Open',
      };
    case 'TMP_Priority':
      return {
        laneKey: 'priority',
        message: 'Priority lane',
        status: 'Open',
      };
    case 'TMP_Standard':
    default:
      return {
        laneKey: 'standard',
        message: 'General screening',
        status: 'Open',
      };
  }
}

function extractOfficialApiConfig(html: string): { endpoint: string; subscriptionKey: string } {
  const endpoint = html.match(/url:\s*'([^']+tsa\/wait-times[^']*)'/i)?.[1];
  const subscriptionKey = html.match(/Ocp-Apim-Subscription-Key'\s*:\s*'([^']+)'/i)?.[1];

  if (!endpoint || !subscriptionKey) {
    throw new Error('PIT security page did not expose wait API config');
  }

  return {
    endpoint,
    subscriptionKey,
  };
}

async function getPitApiConfig(): Promise<{ endpoint: string; subscriptionKey: string }> {
  const now = Date.now();
  const cachedConfig = getFreshCacheValue(pitConfigCache, now);
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const pageResponse = await fetchWithTimeout(PIT_SECURITY_PAGE_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
      },
    });

    if (!pageResponse.ok) {
      throw new Error(`PIT security page returned ${pageResponse.status}`);
    }

    const pageHtml = await pageResponse.text();
    const config = extractOfficialApiConfig(pageHtml);
    pitConfigCache = createTimedCache(config, PIT_CONFIG_CACHE_MS, now);
    return config;
  } catch (error) {
    if (pitConfigCache) {
      return pitConfigCache.value;
    }

    throw error;
  }
}

export async function fetchPitWaitSnapshot(): Promise<PitWaitSnapshot> {
  const { endpoint, subscriptionKey } = await getPitApiConfig();

  const waitResponse = await fetchWithTimeout(endpoint, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!waitResponse.ok) {
    throw new Error(`PIT wait API returned ${waitResponse.status}`);
  }

  const payload = (await waitResponse.json()) as PitWaitApiEntry[];
  const visibleEntries = payload.filter((entry) => entry.canDisplayData === true);
  if (visibleEntries.length === 0) {
    throw new Error('PIT wait API returned zero visible lanes');
  }

  const checkpoints = visibleEntries.map((entry, index): AirportCheckpoint => {
    const waitMinutes = normalizeWaitMinutes(entry);
    const lane = describeLane(entry);

    return {
      id: `pit-${entry.queueId ?? index + 1}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      name: 'Main Security',
      terminal: 'Main Terminal',
      status: waitMinutes === null ? 'Closed' : lane.status,
      waitMinutes,
      displayWait: waitMinutes === null ? 'Closed' : formatWait(waitMinutes),
      message: lane.message,
      source: 'official',
    };
  });

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
