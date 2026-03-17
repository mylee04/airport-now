import type { AirportCheckpoint } from '../../../shared/airport-status';

type SlcPrecheckStatuses = Record<string, Record<string, string>>;

type SlcWaitPayload = {
  rightnow?: number;
  precheck?: number;
  precheck_checkpoints?: SlcPrecheckStatuses;
};

type SlcWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const SLC_WAIT_URL = 'https://slcairport.com/ajaxtsa/waittimes';

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

export async function fetchSlcWaitSnapshot(): Promise<SlcWaitSnapshot> {
  const response = await fetch(SLC_WAIT_URL, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`SLC wait API returned ${response.status}`);
  }

  const payload = (await response.json()) as SlcWaitPayload;
  const mainWaitMinutes = Math.max(0, Math.round(payload.rightnow ?? 0));
  const precheckWaitMinutes = Math.max(0, Math.round(payload.precheck ?? 0));

  const checkpoints: AirportCheckpoint[] = [
    {
      id: 'slc-main',
      name: 'Main Security',
      terminal: 'Terminal 1',
      status: 'Open',
      waitMinutes: mainWaitMinutes,
      displayWait: formatWait(mainWaitMinutes),
      message: 'General screening',
      source: 'official',
    },
  ];

  for (const [terminal, checkpointStatuses] of Object.entries(payload.precheck_checkpoints ?? {})) {
    for (const [checkpointName, checkpointStatus] of Object.entries(checkpointStatuses)) {
      const isOpen = checkpointStatus.trim().toLowerCase() === 'open';
      checkpoints.push({
        id: `slc-precheck-${terminal}-${checkpointName}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
        name: checkpointName,
        terminal,
        status: isOpen ? 'PreCheck Only' : 'Closed',
        waitMinutes: isOpen ? precheckWaitMinutes : null,
        displayWait: isOpen ? formatWait(precheckWaitMinutes) : 'Closed',
        message: 'TSA PreCheck lane',
        source: 'official',
      });
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes: mainWaitMinutes,
    waitDisplay: formatWait(mainWaitMinutes),
    checkpoints,
  };
}
