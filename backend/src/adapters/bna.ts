import type { AirportCheckpoint } from '../../../shared/airport-status';

type BnaWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const BNA_URL = 'https://flynashville.com/';

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractWaitText(html: string): string {
  const anchorMatch = html.match(/<h3>\s*<span>\s*TSA\s*<\/span>\s*Wait Times\s*<\/h3>/i);
  if (!anchorMatch || anchorMatch.index === undefined) {
    throw new Error('BNA homepage wait card was not found');
  }

  const waitCardWindow = html.slice(anchorMatch.index, anchorMatch.index + 600);
  const blockMatch = waitCardWindow.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
  const waitText = stripTags(blockMatch?.[1] ?? '');
  if (!waitText) {
    throw new Error('BNA homepage wait card did not include a wait value');
  }

  return waitText;
}

function waitTextToMinutes(waitText: string): number {
  const normalized = waitText.toLowerCase().trim();

  if (!normalized || normalized.includes('closed')) {
    return 0;
  }

  const rangeMatch = normalized.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return Math.max(Number(rangeMatch[1]), Number(rangeMatch[2]));
  }

  const lessThanMatch = normalized.match(/less than\s*(\d+)/);
  if (lessThanMatch) {
    return Math.max(1, Number(lessThanMatch[1]) - 1);
  }

  const moreThanMatch = normalized.match(/more than\s*(\d+)/);
  if (moreThanMatch) {
    return Number(moreThanMatch[1]);
  }

  const directMatch = normalized.match(/(\d+)/);
  if (directMatch) {
    return Number(directMatch[1]);
  }

  throw new Error(`BNA homepage wait value was not parseable: ${waitText}`);
}

function normalizeWaitDisplay(waitText: string, waitMinutes: number): string {
  const normalized = waitText.toLowerCase().trim();

  if (!normalized || normalized.includes('closed')) {
    return 'Closed';
  }

  const rangeMatch = normalized.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]} min`;
  }

  if (normalized.includes('less than 10')) {
    return 'Less than 10 min';
  }

  const moreThanMatch = normalized.match(/more than\s*(\d+)/);
  if (moreThanMatch) {
    return `${moreThanMatch[1]}+ min`;
  }

  return waitMinutes < 10 ? 'Less than 10 min' : `${waitMinutes} min`;
}

export async function fetchBnaWaitSnapshot(): Promise<BnaWaitSnapshot> {
  const response = await fetch(BNA_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`BNA homepage returned ${response.status}`);
  }

  const html = await response.text();
  const rawWaitText = extractWaitText(html);
  const waitMinutes = waitTextToMinutes(rawWaitText);
  const waitDisplay = normalizeWaitDisplay(rawWaitText, waitMinutes);
  const isClosed = waitDisplay === 'Closed';

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay,
    checkpoints: [
      {
        id: 'bna-main',
        name: 'Main Security',
        terminal: 'Main Terminal',
        status: isClosed ? 'Closed' : 'Open',
        waitMinutes: isClosed ? null : waitMinutes,
        displayWait: waitDisplay,
        message: 'General screening',
        source: 'official',
      },
    ],
  };
}
