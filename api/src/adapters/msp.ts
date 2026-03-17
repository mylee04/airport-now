import type { AirportCheckpoint } from '../../../shared/airport-status';

type MspWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const MSP_URL = 'https://www.mspairport.com/airport/security-screening/security-wait-times';

function waitTextToMinutes(waitText: string): number {
  const normalized = waitText.toLowerCase().trim();

  const lessThan = normalized.match(/less than\s+(\d+)\s+minutes?/);
  if (lessThan) {
    return Number(lessThan[1]);
  }

  const range = normalized.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    return Number(range[2]);
  }

  const direct = normalized.match(/(\d+)\s+minutes?/);
  if (direct) {
    return Number(direct[1]);
  }

  return 15;
}

export async function fetchMspWaitSnapshot(): Promise<MspWaitSnapshot> {
  const response = await fetch(MSP_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`MSP wait page returned ${response.status}`);
  }

  const html = await response.text();
  const timestampText = html.match(
    /<div class="security-wait-times-block__timestamp">\s*Updated\s*([^<]+?)\s*<\/div>/,
  )?.[1];

  const checkpoints = [...html.matchAll(
    /<div class="security-wait-time__checkpoint-name">\s*<div>([^<]+)<\/div>\s*<\/div>[\s\S]*?<div class="security-wait-time__message">([\s\S]*?)<\/div>\s*<div class="security-wait-time__time">([^<]+)<\/div>/g,
  )].map((match, index) => {
    const name = match[1].trim();
    const message = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const displayWait = match[3].trim();
    const waitMinutes = waitTextToMinutes(displayWait);

    return {
      id: `msp-${index + 1}`,
      name,
      terminal: name.startsWith('T1') ? 'Terminal 1' : 'Terminal 2',
      status: message.toLowerCase().includes('precheck') ? 'PreCheck Only' : 'Open',
      waitMinutes,
      displayWait,
      message,
      source: 'official' as const,
    };
  });

  if (checkpoints.length === 0) {
    throw new Error('MSP wait page parsed zero checkpoints');
  }

  const waitMinutes = Math.max(...checkpoints.map((checkpoint) => checkpoint.waitMinutes ?? 0));
  const waitDisplay = checkpoints
    .map((checkpoint) => checkpoint.displayWait)
    .sort((left, right) => waitTextToMinutes(left) - waitTextToMinutes(right))
    .at(-1) ?? `${waitMinutes} min`;

  return {
    fetchedAt: timestampText ? new Date(timestampText.replace('p.m.', 'PM').replace('a.m.', 'AM')).toISOString() : new Date().toISOString(),
    waitMinutes,
    waitDisplay,
    checkpoints,
  };
}
