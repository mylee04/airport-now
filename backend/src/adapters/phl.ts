import type { AirportCheckpoint } from '../../../shared/airport-status';
import { createTimedCache, fetchWithTimeout, getFreshCacheValue, type TimedCache } from './shared-upstream';

type PhlMetricRange = {
  lower_bound?: number;
  upper_bound?: number;
};

type PhlMetricRow = [string | number, number, PhlMetricRange?];

type PhlWaitPayload = {
  content?: {
    rows?: PhlMetricRow[];
  };
};

type PhlWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const PHL_SECURITY_PAGE_URL = 'https://www.phl.org/flights/security-information/checkpoint-hours';
const PHL_CONFIG_CACHE_MS = 30 * 60_000;

let phlConfigCache: TimedCache<{ endpoint: string; apiKey: string }> | null = null;

const PHL_CHECKPOINTS: Array<{
  zoneId: string;
  checkpointId: string;
  name: string;
  terminal: string;
  message: string;
  status: AirportCheckpoint['status'];
}> = [
  {
    zoneId: '4377',
    checkpointId: 'phl-aw-general',
    name: 'Terminal A-West',
    terminal: 'Terminal A-West',
    message: 'General screening',
    status: 'Open',
  },
  {
    zoneId: '4368',
    checkpointId: 'phl-ae-general',
    name: 'Terminal A-East',
    terminal: 'Terminal A-East',
    message: 'General screening',
    status: 'Open',
  },
  {
    zoneId: '4386',
    checkpointId: 'phl-ae-precheck',
    name: 'Terminal A-East',
    terminal: 'Terminal A-East',
    message: 'TSA PreCheck lane',
    status: 'PreCheck Only',
  },
  {
    zoneId: '5047',
    checkpointId: 'phl-b-general',
    name: 'Terminal B',
    terminal: 'Terminal B',
    message: 'General screening',
    status: 'Open',
  },
  {
    zoneId: '5052',
    checkpointId: 'phl-c-general',
    name: 'Terminal C',
    terminal: 'Terminal C',
    message: 'General screening',
    status: 'Open',
  },
  {
    zoneId: '3971',
    checkpointId: 'phl-de-general',
    name: 'Terminal D/E',
    terminal: 'Terminal D/E',
    message: 'General screening',
    status: 'Open',
  },
  {
    zoneId: '4126',
    checkpointId: 'phl-de-precheck',
    name: 'Terminal D/E',
    terminal: 'Terminal D/E',
    message: 'TSA PreCheck lane',
    status: 'PreCheck Only',
  },
  {
    zoneId: '5068',
    checkpointId: 'phl-f-general',
    name: 'Terminal F',
    terminal: 'Terminal F',
    message: 'General screening',
    status: 'Open',
  },
];

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function extractWaitScriptUrl(html: string): string {
  const match = html.match(/<script[^>]+src="([^"]*\/modules\/custom\/phl_wait_api\/js\/wait-api\.js[^"]*)"/i)?.[1];
  if (!match) {
    throw new Error('PHL security page did not expose the wait API script');
  }

  return new URL(match, PHL_SECURITY_PAGE_URL).toString();
}

function extractApiConfig(script: string): { endpoint: string; apiKey: string } {
  const endpoint = script.match(/url:\s*'([^']+metrics\/live[^']*)'/i)?.[1];
  const apiKey = script.match(/Authorization",\s*'Api-Key ([^']+)'/i)?.[1];

  if (!endpoint || !apiKey) {
    throw new Error('PHL wait API script did not expose endpoint config');
  }

  return { endpoint, apiKey };
}

async function getPhlApiConfig(): Promise<{ endpoint: string; apiKey: string }> {
  const now = Date.now();
  const cachedConfig = getFreshCacheValue(phlConfigCache, now);
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const pageResponse = await fetchWithTimeout(PHL_SECURITY_PAGE_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
      },
    });

    if (!pageResponse.ok) {
      throw new Error(`PHL security page returned ${pageResponse.status}`);
    }

    const pageHtml = await pageResponse.text();
    const scriptUrl = extractWaitScriptUrl(pageHtml);

    const scriptResponse = await fetchWithTimeout(scriptUrl, {
      headers: {
        Accept: 'application/javascript, text/javascript, */*;q=0.1',
        Referer: PHL_SECURITY_PAGE_URL,
        'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
      },
    });

    if (!scriptResponse.ok) {
      throw new Error(`PHL wait script returned ${scriptResponse.status}`);
    }

    const scriptBody = await scriptResponse.text();
    const config = extractApiConfig(scriptBody);
    phlConfigCache = createTimedCache(config, PHL_CONFIG_CACHE_MS, now);
    return config;
  } catch (error) {
    if (phlConfigCache) {
      return phlConfigCache.value;
    }

    throw error;
  }
}

export async function fetchPhlWaitSnapshot(): Promise<PhlWaitSnapshot> {
  const { endpoint, apiKey } = await getPhlApiConfig();

  const waitResponse = await fetchWithTimeout(endpoint, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: `Api-Key ${apiKey}`,
      Referer: PHL_SECURITY_PAGE_URL,
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!waitResponse.ok) {
    throw new Error(`PHL wait API returned ${waitResponse.status}`);
  }

  const payload = (await waitResponse.json()) as PhlWaitPayload;
  const rows = payload.content?.rows ?? [];
  const waitByZoneId = new Map(rows.map((row) => [String(row[0]), row]));
  const checkpoints = PHL_CHECKPOINTS.flatMap((checkpoint): AirportCheckpoint[] => {
    const row = waitByZoneId.get(checkpoint.zoneId);
    if (!row || typeof row[1] !== 'number') {
      return [];
    }

    const waitMinutes = Math.max(0, Math.ceil(row[1]));
    return [
      {
        id: checkpoint.checkpointId,
        name: checkpoint.name,
        terminal: checkpoint.terminal,
        status: checkpoint.status,
        waitMinutes,
        displayWait: formatWait(waitMinutes),
        message: checkpoint.message,
        source: 'official',
      },
    ];
  });

  if (checkpoints.length === 0) {
    throw new Error('PHL wait API returned zero mapped checkpoints');
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
