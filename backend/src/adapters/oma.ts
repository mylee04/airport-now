import type { AirportCheckpoint } from '../../../shared/airport-status';
import { fetchWithTimeout } from './shared-upstream';

type OmaWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const OMA_WAIT_URL = 'https://www.flyoma.com/passenger-services/security-checkpoint-wait-times/';

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRangeWait(rawValue: string): { waitMinutes: number; waitDisplay: string } {
  const normalized = rawValue.trim();
  const rangeMatch = normalized.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return {
      waitMinutes: Number(rangeMatch[2]),
      waitDisplay: `${rangeMatch[1]}-${rangeMatch[2]} min`,
    };
  }

  const directMatch = normalized.match(/(\d+)/);
  if (!directMatch) {
    throw new Error(`OMA wait page returned an invalid range: ${rawValue}`);
  }

  const waitMinutes = Number(directMatch[1]);

  return {
    waitMinutes,
    waitDisplay: waitMinutes < 10 ? 'Less than 10 min' : `${waitMinutes} min`,
  };
}

function parseConcourseCards(html: string): AirportCheckpoint[] {
  const matches = [
    ...html.matchAll(
      /<li class="tsa-wait-times-element_concourse-list_concourse-info[^"]*">([\s\S]*?)<\/li>/gi,
    ),
  ];

  if (matches.length === 0) {
    throw new Error('OMA wait page did not expose any concourse cards');
  }

  return matches.map((match, index) => {
    const block = match[1];
    const title = stripTags(
      block.match(/tsa-wait-times-element_concourse-list_concourse-info_title">([\s\S]*?)<\/span>/i)?.[1] ??
        `Checkpoint ${index + 1}`,
    );
    const rawTime = stripTags(
      block.match(/tsa-wait-times-element_concourse-list_concourse-info_time">([\s\S]*?)<\/span>/i)?.[1] ??
        '',
    );
    const { waitMinutes, waitDisplay } = parseRangeWait(rawTime);

    return {
      id: `oma-${index + 1}`,
      name: title,
      terminal: title,
      status: 'Open',
      waitMinutes,
      displayWait: waitDisplay,
      message: 'General screening',
      source: 'official',
    };
  });
}

export async function fetchOmaWaitSnapshot(): Promise<OmaWaitSnapshot> {
  const response = await fetchWithTimeout(OMA_WAIT_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`OMA wait page returned ${response.status}`);
  }

  const html = await response.text();
  const checkpoints = parseConcourseCards(html);
  const topCheckpoint = checkpoints.reduce((best, checkpoint) =>
    (checkpoint.waitMinutes ?? 0) > (best.waitMinutes ?? 0) ? checkpoint : best,
  );

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes: topCheckpoint.waitMinutes ?? 0,
    waitDisplay: topCheckpoint.displayWait,
    checkpoints,
  };
}
