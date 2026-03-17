import type { AirportCheckpoint } from '../../../shared/airport-status';

type JfkSecurityWaitTimePoint = {
  title?: string;
  terminal?: string;
  gate?: string;
  checkPoint?: string;
  queueType?: string;
  isOpen?: boolean;
  waitTime?: number;
  isWaitTimeAvailable?: boolean;
  status?: string;
  lastUpdated?: string;
};

type JfkGraphqlResponse = {
  data?: {
    securityWaitTimes?: JfkSecurityWaitTimePoint[];
  };
};

type JfkWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportCheckpoint[];
};

const JFK_GRAPHQL_URL = 'https://api.jfkairport.com/graphql';
const JFK_SECURITY_QUERY = `
  query GetSecurityWaitTimes($airportCode: String!, $terminal: String) {
    securityWaitTimes(airportCode: $airportCode, terminal: $terminal) {
      title
      terminal
      gate
      checkPoint
      queueType
      isOpen
      waitTime
      isWaitTimeAvailable
      status
      lastUpdated
      __typename
    }
  }
`;

function formatWait(waitMinutes: number): string {
  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function laneMessage(queueType?: string): string {
  return queueType === 'TSAPre' ? 'TSA PreCheck lane' : 'General screening';
}

export async function fetchJfkWaitSnapshot(): Promise<JfkWaitSnapshot> {
  const response = await fetch(JFK_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'User-Agent': 'AirportNow/0.1 (+https://airport-now.local)',
    },
    body: JSON.stringify({
      operationName: 'GetSecurityWaitTimes',
      variables: {
        airportCode: 'JFK',
      },
      extensions: {
        clientLibrary: {
          name: '@apollo/client',
          version: '4.0.4',
        },
      },
      query: JFK_SECURITY_QUERY,
    }),
  });

  if (!response.ok) {
    throw new Error(`JFK security GraphQL returned ${response.status}`);
  }

  const payload = (await response.json()) as JfkGraphqlResponse;
  const rows = payload.data?.securityWaitTimes ?? [];
  if (rows.length === 0) {
    throw new Error('JFK security GraphQL returned zero wait rows');
  }

  const checkpoints = rows
    .filter((row) => typeof row.title === 'string' && typeof row.terminal === 'string')
    .map((row): AirportCheckpoint => {
      const isOpen = row.isOpen === true && row.isWaitTimeAvailable !== false;
      const waitMinutes = isOpen && typeof row.waitTime === 'number' ? Math.max(0, row.waitTime) : null;
      const isPrecheck = row.queueType === 'TSAPre';

      return {
        id: `jfk-${row.terminal}-${row.queueType ?? 'reg'}`,
        name: row.title?.trim() || `Terminal ${row.terminal}`,
        terminal: `Terminal ${row.terminal}`,
        status: !isOpen ? 'Closed' : isPrecheck ? 'PreCheck Only' : 'Open',
        waitMinutes,
        displayWait: !isOpen || waitMinutes === null ? 'Closed' : formatWait(waitMinutes),
        message: laneMessage(row.queueType),
        source: 'official',
      };
    });

  if (checkpoints.length === 0) {
    throw new Error('JFK security GraphQL returned zero usable checkpoints');
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
