import type { AirportCheckpoint } from '../../../shared/airport-status';

type DtwWaitEntry = {
  Name?: string;
  WaitTime?: number;
};

type DtwWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const DTW_WAIT_URL = 'https://proxy.metroairport.com/SkyFiiTSAProxy.ashx';

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

export async function fetchDtwWaitSnapshot(): Promise<DtwWaitSnapshot> {
  const response = await fetch(DTW_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`DTW wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as DtwWaitEntry[];
  const checkpoints = payload
    .filter((entry) => typeof entry.Name === 'string' && typeof entry.WaitTime === 'number')
    .map((entry, index): AirportCheckpoint => {
      const waitMinutes = Math.max(0, entry.WaitTime ?? 0);
      const terminalName = `${entry.Name?.trim() || `Terminal ${index + 1}`} Terminal`;

      return {
        id: `dtw-${index + 1}`,
        name: terminalName,
        terminal: terminalName,
        status: 'Open',
        waitMinutes,
        displayWait: formatWait(waitMinutes),
        message: 'General screening',
        source: 'official',
      };
    });

  if (checkpoints.length === 0) {
    throw new Error('DTW wait API returned zero usable checkpoints');
  }

  const waitMinutes = Math.max(...checkpoints.map((checkpoint) => checkpoint.waitMinutes ?? 0));

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay: formatWait(waitMinutes),
    checkpoints,
  };
}
