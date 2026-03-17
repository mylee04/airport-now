import type { AirportCheckpoint } from '../../../shared/airport-status';
import { fetchWithTimeout } from './shared-upstream';

type EwrWaitPoint = {
  pointID?: number;
  title?: string;
  terminal?: string;
  gate?: string;
  queueType?: string;
  queueOpen?: boolean;
  isWaitTimeAvailable?: boolean;
  timeInMinutes?: number;
  timeInSeconds?: number;
};

type EwrWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const EWR_WAIT_URL = 'https://avi-prod-mpp-webapp-api.azurewebsites.net/api/v1/SecurityWaitTimesPoints/EWR';
const EWR_REFERER = 'https://www.newarkairport.com/';

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

export async function fetchEwrWaitSnapshot(): Promise<EwrWaitSnapshot> {
  const response = await fetchWithTimeout(EWR_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: EWR_REFERER,
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`EWR wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as EwrWaitPoint[];
  const checkpoints = payload.map((point, index): AirportCheckpoint => {
    const isOpen = point.queueOpen === true && point.isWaitTimeAvailable !== false;
    const isPrecheck = (point.queueType ?? '').trim().toLowerCase() === 'tsapre';
    const rawWaitMinutes =
      typeof point.timeInMinutes === 'number'
        ? point.timeInMinutes
        : typeof point.timeInSeconds === 'number'
          ? point.timeInSeconds / 60
          : 0;
    const waitMinutes = isOpen ? Math.max(0, Math.ceil(rawWaitMinutes)) : null;
    const terminalLabel = point.title?.trim() || (point.terminal ? `Terminal ${point.terminal}` : `Checkpoint ${index + 1}`);
    const gateLabel = point.gate?.trim();

    return {
      id: `ewr-${point.pointID ?? index + 1}`,
      name: gateLabel ? `${terminalLabel} ${gateLabel}` : terminalLabel,
      terminal: point.terminal ? `Terminal ${point.terminal}` : terminalLabel,
      status: waitMinutes === null ? 'Closed' : isPrecheck ? 'PreCheck Only' : 'Open',
      waitMinutes,
      displayWait: waitMinutes === null ? 'Closed' : formatWait(waitMinutes),
      message: isPrecheck ? 'TSA PreCheck lane' : 'General screening',
      source: 'official',
    };
  });

  if (checkpoints.length === 0) {
    throw new Error('EWR wait API returned zero usable checkpoints');
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
