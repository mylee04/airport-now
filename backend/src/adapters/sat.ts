import type { AirportCheckpoint } from '../../../shared/airport-status';
import { fetchWithTimeout } from './shared-upstream';

type SatWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const SAT_SECURITY_URL = 'https://flysanantonio.com/home/flights/security-checkpoints-wait-time/';

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function parseScriptDigit(html: string, inputId: string): string {
  const escapedId = inputId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`\\$\\('#${escapedId}'\\)\\.val\\('([^']+)'\\)`, 'i'))?.[1]?.trim();

  if (!match) {
    throw new Error(`SAT security page did not expose the ${inputId} digit`);
  }

  return match;
}

function parseTerminalWaitMinutes(html: string, terminalId: 'terminala' | 'terminalb'): number {
  const tens = parseScriptDigit(html, `${terminalId}-one`);
  const ones = parseScriptDigit(html, `${terminalId}-two`);
  const rawValue = `${tens}${ones}`.replace(/\s+/g, '');
  const waitMinutes = Number(rawValue);

  if (!Number.isFinite(waitMinutes) || waitMinutes < 0) {
    throw new Error(`SAT security page returned an invalid wait value for ${terminalId}: ${rawValue}`);
  }

  return waitMinutes;
}

export async function fetchSatWaitSnapshot(): Promise<SatWaitSnapshot> {
  const response = await fetchWithTimeout(SAT_SECURITY_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`SAT security page returned ${response.status}`);
  }

  const html = await response.text();
  const terminalAWait = parseTerminalWaitMinutes(html, 'terminala');
  const terminalBWait = parseTerminalWaitMinutes(html, 'terminalb');
  const checkpoints: AirportCheckpoint[] = [
    {
      id: 'sat-terminal-a',
      name: 'Main Security',
      terminal: 'Terminal A',
      status: 'Open',
      waitMinutes: terminalAWait,
      displayWait: formatWait(terminalAWait),
      message: 'General screening',
      source: 'official',
    },
    {
      id: 'sat-terminal-b',
      name: 'Main Security',
      terminal: 'Terminal B',
      status: 'Open',
      waitMinutes: terminalBWait,
      displayWait: formatWait(terminalBWait),
      message: 'General screening',
      source: 'official',
    },
  ];
  const waitMinutes = Math.max(terminalAWait, terminalBWait);

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay: formatWait(waitMinutes),
    checkpoints,
  };
}
