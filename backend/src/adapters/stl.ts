import type { AirportCheckpoint } from '../../../shared/airport-status';

type StlWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const STL_WAIT_URL = 'https://www.flystl.com/tsa-security/';

function decodeHtml(value: string): string {
  return value
    .replace(/&#8211;/g, '-')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatWait(waitMinutes: number): string {
  if (waitMinutes <= 0) {
    return 'Closed';
  }

  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function parseEstimateMinutes(html: string): number {
  const direct = html.match(/aria-valuenow="(\d+)"/i)?.[1];
  if (direct) {
    return Number(direct);
  }

  const labelText = html.match(/aria-label="Wait time is approximately ([^"]+)"/i)?.[1];
  const fallback = labelText?.match(/(\d+)/)?.[1];
  if (fallback) {
    return Number(fallback);
  }

  throw new Error('STL security page did not expose an estimate value');
}

function parseCheckpointCard(sectionHtml: string, waitMinutes: number, index: number): AirportCheckpoint {
  const title = decodeHtml(sectionHtml.match(/<h3[^>]*>([^<]+)<\/h3>/i)?.[1] ?? `Checkpoint ${index + 1}`);
  const availability = decodeHtml(
    sectionHtml.match(/aria-label="Destination availability status: ([^"]+)"/i)?.[1] ?? 'Open',
  );
  const terminalMatch = title.match(/^T(\d+),\s*(.+)$/i);
  const isOpen = availability.toLowerCase() === 'open';

  return {
    id: `stl-${index + 1}`,
    name: terminalMatch ? terminalMatch[2].trim() : title,
    terminal: terminalMatch ? `Terminal ${terminalMatch[1]}` : title,
    status: isOpen ? 'Open' : 'Closed',
    waitMinutes: isOpen ? waitMinutes : null,
    displayWait: isOpen ? formatWait(waitMinutes) : 'Closed',
    message: 'General screening',
    source: 'official',
  };
}

export async function fetchStlWaitSnapshot(): Promise<StlWaitSnapshot> {
  const response = await fetch(STL_WAIT_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`STL security page returned ${response.status}`);
  }

  const html = await response.text();
  const waitMinutes = parseEstimateMinutes(html);
  const sections = [...html.matchAll(/<section class="overflow-hidden card rounded-xl"[\s\S]*?<\/section>/g)];
  const checkpoints = sections.map((section, index) => parseCheckpointCard(section[0], waitMinutes, index));

  if (checkpoints.length === 0) {
    throw new Error('STL security page parsed zero checkpoint cards');
  }

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay: formatWait(waitMinutes),
    checkpoints,
  };
}
