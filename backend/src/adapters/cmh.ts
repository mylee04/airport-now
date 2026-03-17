import type { AirportCheckpoint } from '../../../shared/airport-status';

type CmhWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const CMH_SECURITY_URL = 'https://flycolumbus.com/passengers/security/';

function decodeHtml(value: string): string {
  return value
    .replace(/&#8211;/g, '-')
    .replace(/&#8217;/g, "'")
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCurrentEstimate(html: string): { waitMinutes: number; waitDisplay: string } {
  const rawValue = decodeHtml(
    html.match(/Passengers moving through the security checkpoints should anticipate waiting on average for:[\s\S]{0,120}?<strong[^>]*>([^<]+)<\/strong>/i)?.[1] ??
      html.match(/Passengers moving through the security checkpoints should anticipate waiting on average for:\s*<br[^>]*>\s*([^<]+)/i)?.[1] ??
      html.match(/Passengers moving through the security checkpoints should anticipate waiting on average for:\s*([^<]+)/i)?.[1] ??
      '',
  );

  if (!rawValue) {
    throw new Error('CMH security page did not expose a current estimate value');
  }

  const minuteMatch = rawValue.match(/(\d+)\s*minutes?/i);
  const secondMatch = rawValue.match(/(\d+)\s*seconds?/i);
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const seconds = secondMatch ? Number(secondMatch[1]) : 0;
  const totalSeconds = minutes * 60 + seconds;

  if (totalSeconds <= 0) {
    throw new Error(`CMH security page returned an invalid estimate value: ${rawValue}`);
  }

  return {
    waitMinutes: Math.ceil(totalSeconds / 60),
    waitDisplay: totalSeconds < 600 ? 'Less than 10 min' : `${Math.ceil(totalSeconds / 60)} min`,
  };
}

export async function fetchCmhWaitSnapshot(): Promise<CmhWaitSnapshot> {
  const response = await fetch(CMH_SECURITY_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`CMH security page returned ${response.status}`);
  }

  const html = await response.text();
  const { waitMinutes, waitDisplay } = parseCurrentEstimate(html);

  return {
    fetchedAt: new Date().toISOString(),
    waitMinutes,
    waitDisplay,
    checkpoints: [
      {
        id: 'cmh-estimate',
        name: 'Airport-wide estimate',
        terminal: 'Main Terminal',
        status: 'Open',
        waitMinutes,
        displayWait: waitDisplay,
        message: 'General screening',
        source: 'official',
      },
    ],
  };
}
