import type { AirportCheckpoint } from '../../../shared/airport-status';
import { fetchWithTimeout } from './shared-upstream';

type JaxWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const JAX_WAIT_URL = 'https://flyjacksonville.com/jaa/content.aspx?id=3583';

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#10004;/g, '')
    .replace(/&#8482;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function parseCheckpointCards(html: string): AirportCheckpoint[] {
  const matches = [
    ...html.matchAll(
      /<div class="label(?:[^"]*)?"[^>]*>([\s\S]*?)<\/div>[\s\S]{0,220}?<span class="bold ml-1">(\d+)\s*min<\/span>/gi,
    ),
  ];

  if (matches.length === 0) {
    throw new Error('JAX wait page did not expose any checkpoint cards');
  }

  return matches.map((match, index) => {
    const rawLabel = stripTags(match[1] ?? '');
    const waitMinutes = Number(match[2]);
    const normalizedLabel = rawLabel.toLowerCase();
    const isPrecheck = normalizedLabel.includes('tsa pre');
    const isMilitary = normalizedLabel.includes('military');
    const name = isPrecheck ? 'TSA PreCheck' : rawLabel || `Checkpoint ${index + 1}`;

    return {
      id: `jax-${index + 1}`,
      name,
      terminal: 'Main Terminal',
      status: isPrecheck ? 'PreCheck Only' : 'Open',
      waitMinutes,
      displayWait: formatWait(waitMinutes),
      message: isPrecheck
        ? 'TSA PreCheck lane'
        : isMilitary
          ? 'Military in uniform lane'
          : 'General screening',
      source: 'official',
    };
  });
}

export async function fetchJaxWaitSnapshot(): Promise<JaxWaitSnapshot> {
  const response = await fetchWithTimeout(JAX_WAIT_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`JAX wait page returned ${response.status}`);
  }

  const html = await response.text();
  const checkpoints = parseCheckpointCards(html);
  const generalEntries = checkpoints.filter(
    (checkpoint) => checkpoint.message === 'General screening' && checkpoint.waitMinutes !== null,
  );
  const aggregatePool =
    generalEntries.length > 0
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
