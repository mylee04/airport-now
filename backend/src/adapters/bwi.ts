import type { AirportCheckpoint } from '../../../shared/airport-status';

type BwiWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const BWI_URL = 'https://bwiairport.com/';

function waitTextToMinutes(waitText: string): number | null {
  const normalized = waitText.toLowerCase().trim();
  if (!normalized || normalized === 'closed') {
    return null;
  }

  const lessThan = normalized.match(/<\s*(\d+)/);
  if (lessThan) {
    return Math.max(1, Number(lessThan[1]) - 1);
  }

  const direct = normalized.match(/(\d+)/);
  return direct ? Number(direct[1]) : null;
}

function formatAggregateWait(waitMinutes: number): string {
  if (waitMinutes <= 0) {
    return 'Closed';
  }

  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

export async function fetchBwiWaitSnapshot(): Promise<BwiWaitSnapshot> {
  const response = await fetch(BWI_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`BWI homepage returned ${response.status}`);
  }

  const html = await response.text();
  const rows = [...html.matchAll(
    /<tr class="hud_security_table_row_([^"]+)">[\s\S]*?<span class="hud_security_hint">Checkpoint<\/span>\s*([^<]+)<\/td>[\s\S]*?<td class="js-security-[^"]+-general">([^<]+)<\/td>[\s\S]*?<td class="js-security-[^"]+-priority">([^<]+)<\/td>[\s\S]*?<td class="js-security-[^"]+-tsa_pre">([^<]+)<\/td>[\s\S]*?<td class="js-security-[^"]+-clear">([^<]+)<\/td>[\s\S]*?<\/tr>/g,
  )];

  if (rows.length === 0) {
    throw new Error('BWI homepage parsed zero checkpoints');
  }

  const checkpoints: AirportCheckpoint[] = [];

  for (const match of rows) {
    const checkpointLabel = `Checkpoint ${match[2].trim()}`;
    const lanes = [
      { key: 'general', label: 'General screening', value: match[3].trim(), status: 'Open' as const },
      { key: 'priority', label: 'Priority lane', value: match[4].trim(), status: 'Open' as const },
      { key: 'tsa-pre', label: 'TSA PreCheck lane', value: match[5].trim(), status: 'PreCheck Only' as const },
      { key: 'clear', label: 'CLEAR lane', value: match[6].trim(), status: 'Open' as const },
    ];

    for (const lane of lanes) {
      const waitMinutes = waitTextToMinutes(lane.value);
      checkpoints.push({
        id: `bwi-${match[1].toLowerCase()}-${lane.key}`,
        name: checkpointLabel,
        terminal: 'Main Terminal',
        status: waitMinutes === null ? 'Closed' : lane.status,
        waitMinutes,
        displayWait: waitMinutes === null ? 'Closed' : lane.value,
        message: lane.label,
        source: 'official',
      });
    }
  }

  const generalEntries = checkpoints.filter(
    (checkpoint) => checkpoint.message === 'General screening' && checkpoint.waitMinutes !== null,
  );
  const aggregatePool = generalEntries.length > 0 ? generalEntries : checkpoints.filter((checkpoint) => checkpoint.waitMinutes !== null);
  const waitMinutes =
    aggregatePool.length > 0
      ? Math.max(...aggregatePool.map((checkpoint) => checkpoint.waitMinutes ?? 0))
      : 0;

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay: formatAggregateWait(waitMinutes),
    checkpoints,
  };
}
