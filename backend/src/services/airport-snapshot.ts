import {
  AIRPORT_CODES,
  buildSeedAirportStatuses,
  getCrowdLevel,
  type AirportCode,
  type AirportsApiResponse,
  type AirportStatus,
} from '../../../shared/airport-status';
import { fetchAtlWaitSnapshot } from '../adapters/atl';
import { fetchBnaWaitSnapshot } from '../adapters/bna';
import { fetchBwiWaitSnapshot } from '../adapters/bwi';
import { fetchChsWaitSnapshot } from '../adapters/chs';
import { fetchCleWaitSnapshot } from '../adapters/cle';
import { fetchCltWaitSnapshot } from '../adapters/clt';
import { fetchCmhWaitSnapshot } from '../adapters/cmh';
import { fetchCvgWaitSnapshot } from '../adapters/cvg';
import { fetchDcaWaitSnapshot, fetchIadWaitSnapshot } from '../adapters/mwaa';
import { fetchDenWaitSnapshot } from '../adapters/den';
import { fetchDtwWaitSnapshot } from '../adapters/dtw';
import { fetchDfwWaitSnapshot } from '../adapters/dfw';
import { fetchEwrWaitSnapshot } from '../adapters/ewr';
import { fetchFaaSnapshot } from '../adapters/faa';
import { fetchIahWaitSnapshot } from '../adapters/iah';
import { fetchHouWaitSnapshot } from '../adapters/hou';
import { fetchJaxWaitSnapshot } from '../adapters/jax';
import { fetchJfkWaitSnapshot } from '../adapters/jfk';
import { fetchLaxWaitSnapshot } from '../adapters/lax';
import { fetchMcoWaitSnapshot } from '../adapters/mco';
import { fetchMiaWaitSnapshot } from '../adapters/mia';
import { fetchMspWaitSnapshot } from '../adapters/msp';
import { fetchOmaWaitSnapshot } from '../adapters/oma';
import { fetchPdxWaitSnapshot } from '../adapters/pdx';
import { fetchPhlWaitSnapshot } from '../adapters/phl';
import { fetchPhxWaitSnapshot } from '../adapters/phx';
import { fetchPitWaitSnapshot } from '../adapters/pit';
import { fetchSatWaitSnapshot } from '../adapters/sat';
import { fetchSlcWaitSnapshot } from '../adapters/slc';
import { fetchStlWaitSnapshot } from '../adapters/stl';
import { getRecentReportSummaryByAirport } from './report-store';
import { getTravelPressure } from './travel-pressure';

type SnapshotCache = {
  expiresAt: number;
  value: AirportsApiResponse;
};

type FaaAirportEvent = Awaited<ReturnType<typeof fetchFaaSnapshot>>['eventsByAirport'][AirportCode];
type ReportSummary = Awaited<ReturnType<typeof getRecentReportSummaryByAirport>>[AirportCode];
type AirportWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportStatus['checkpoints'];
};

let cache: SnapshotCache | null = null;
let inFlightSnapshot: Promise<AirportsApiResponse> | null = null;
const AIRPORT_INDEX = Object.fromEntries(
  AIRPORT_CODES.map((code, index) => [code, index]),
) as Record<AirportCode, number>;
const STALE_OFFICIAL_WAIT_MS = 30 * 60_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function withUnique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function formatDerivedWaitDisplay(waitMinutes: number): string {
  if (waitMinutes <= 0) {
    return 'No live checkpoint feed';
  }

  if (waitMinutes < 10) {
    return 'Less than 10 min';
  }

  return `${waitMinutes} min`;
}

function getReusableOfficialWait(
  previousSnapshot: AirportsApiResponse | null,
  airportCode: AirportCode,
  now: number,
): AirportStatus | null {
  const previous = previousSnapshot?.airports.find((airport) => airport.code === airportCode);
  if (!previous) {
    return null;
  }

  if (previous.waitTimeSource !== 'official' && previous.waitTimeSource !== 'official_estimate') {
    return null;
  }

  const updatedAt = new Date(previous.updatedAt).getTime();
  if (!Number.isFinite(updatedAt) || now - updatedAt > STALE_OFFICIAL_WAIT_MS) {
    return null;
  }

  return previous;
}

function reuseStaleOfficialWait(
  airports: AirportStatus[],
  previousSnapshot: AirportsApiResponse | null,
  airportCode: AirportCode,
  now: number,
): AirportStatus[] {
  const staleAirport = getReusableOfficialWait(previousSnapshot, airportCode, now);
  if (!staleAirport) {
    return airports;
  }

  return airports.map((airport) => (airport.code === airportCode ? staleAirport : airport));
}

function mergeSentence(base: string, addition: string): string {
  return `${base} ${addition}`.trim();
}

function raiseConfidence(current: AirportStatus['confidence']): AirportStatus['confidence'] {
  if (current === 'Low') {
    return 'Medium';
  }

  return current;
}

function derivedQueueDelayRisk(waitMinutes: number): number {
  if (waitMinutes >= 40) {
    return 30;
  }

  if (waitMinutes >= 25) {
    return 18;
  }

  if (waitMinutes >= 15) {
    return 10;
  }

  if (waitMinutes > 0) {
    return 4;
  }

  return 0;
}

function buildRecommendation(status: AirportStatus): string {
  if (status.delayRisk >= 60 || status.cancelRisk >= 20) {
    return `High disruption pressure at ${status.code}. Monitor airline alerts closely and leave extra time before departure.`;
  }

  if (
    status.waitTimeSource === 'official' ||
    status.waitTimeSource === 'official_estimate' ||
    status.waitTimeSource === 'community'
  ) {
    if (status.waitMinutes >= 25) {
      if (status.waitTimeSource === 'official_estimate') {
        return `Official checkpoint estimates are elevated at ${status.code}. Add extra buffer before you head to the airport.`;
      }

      return `Checkpoint demand is elevated at ${status.code}. Add extra buffer before you head to the airport.`;
    }

    if (status.waitTimeSource === 'official_estimate') {
      return `Official checkpoint estimates look manageable at ${status.code}, but keep watching for airport updates.`;
    }

    return `Current checkpoint pressure looks manageable at ${status.code}, but keep watching for airline updates.`;
  }

  return `This airport does not publish a live checkpoint wait feed yet. Use airport and airline alerts until more live data is available.`;
}

function applyTravelPressureSignal(status: AirportStatus, generatedAt: string): AirportStatus {
  const pressure = getTravelPressure(new Date(generatedAt));
  if (pressure.signals.length === 0) {
    return status;
  }

  return {
    ...status,
    dataSources: withUnique([...status.dataSources, 'Airport Now travel calendar heuristic']),
    signals: withUnique([...status.signals, ...pressure.signals]),
    note: mergeSentence(status.note, pressure.noteFragments[0] ?? ''),
    insight: mergeSentence(status.insight, pressure.driverFragments[0] ?? ''),
    recommendation: buildRecommendation(status),
  };
}

function applyOfficialWait(
  status: AirportStatus,
  snapshot: AirportWaitSnapshot,
  options: {
    dataSource: string;
    note: string;
    insight: string;
  },
): AirportStatus {
  const queueDelayRisk = derivedQueueDelayRisk(snapshot.waitMinutes);

  return {
    ...status,
    waitMinutes: snapshot.waitMinutes,
    waitDisplay: snapshot.waitDisplay,
    waitTimeSource: 'official',
    crowdLevel: getCrowdLevel(snapshot.waitMinutes),
    confidence: 'Medium',
    delayRisk: Math.max(status.delayRisk, queueDelayRisk),
    cancelRisk: Math.max(status.cancelRisk, snapshot.waitMinutes >= 40 ? 2 : 0),
    updatedAt: snapshot.fetchedAt,
    checkpoints: snapshot.checkpoints,
    dataSources: withUnique([...status.dataSources, options.dataSource]),
    note: mergeSentence(options.note, snapshot.waitMinutes > 0 ? `Current top checkpoint wait is ${snapshot.waitDisplay}.` : ''),
    insight: options.insight,
    recommendation: buildRecommendation({
      ...status,
      waitMinutes: snapshot.waitMinutes,
      waitTimeSource: 'official',
      delayRisk: Math.max(status.delayRisk, queueDelayRisk),
      cancelRisk: Math.max(status.cancelRisk, snapshot.waitMinutes >= 40 ? 2 : 0),
    }),
  };
}

function applyOfficialEstimateWait(
  status: AirportStatus,
  snapshot: AirportWaitSnapshot,
  options: {
    dataSource: string;
    note: string;
    insight: string;
  },
): AirportStatus {
  const queueDelayRisk = derivedQueueDelayRisk(snapshot.waitMinutes);

  return {
    ...status,
    waitMinutes: snapshot.waitMinutes,
    waitDisplay: snapshot.waitDisplay,
    waitTimeSource: 'official_estimate',
    crowdLevel: getCrowdLevel(snapshot.waitMinutes),
    confidence: 'Medium',
    delayRisk: Math.max(status.delayRisk, queueDelayRisk),
    cancelRisk: Math.max(status.cancelRisk, snapshot.waitMinutes >= 40 ? 1 : 0),
    updatedAt: snapshot.fetchedAt,
    checkpoints: snapshot.checkpoints,
    dataSources: withUnique([...status.dataSources, options.dataSource]),
    note: mergeSentence(options.note, snapshot.waitMinutes > 0 ? `Current top checkpoint estimate is ${snapshot.waitDisplay}.` : ''),
    insight: options.insight,
    recommendation: buildRecommendation({
      ...status,
      waitMinutes: snapshot.waitMinutes,
      waitTimeSource: 'official_estimate',
      delayRisk: Math.max(status.delayRisk, queueDelayRisk),
      cancelRisk: Math.max(status.cancelRisk, snapshot.waitMinutes >= 40 ? 1 : 0),
    }),
  };
}

function applyFaaRisk(status: AirportStatus, event: FaaAirportEvent): AirportStatus {
  if (!event) {
    return status;
  }

  let delayRisk = status.delayRisk;
  let cancelRisk = status.cancelRisk;
  const fragments: string[] = [];

  if (event.groundStopReason) {
    delayRisk += 22;
    cancelRisk += 12;
    fragments.push(`FAA ground stop in effect for ${event.groundStopReason}`);
  }

  if (event.groundDelayAverageMinutes) {
    delayRisk += Math.min(32, Math.round(event.groundDelayAverageMinutes / 4));
    fragments.push(`FAA ground delay averaging ${event.groundDelayAverageMinutes} minutes`);
  }

  if (event.departureDelayMaxMinutes) {
    delayRisk += Math.min(20, Math.round(event.departureDelayMaxMinutes / 6));
    fragments.push(`departure delay window up to ${event.departureDelayMaxMinutes} minutes`);
  }

  if (event.closureReason) {
    delayRisk += 18;
    cancelRisk += 35;
    fragments.push(`airport closure restrictions are active for ${event.closureReason}`);
  }

  const reasonBlob = [
    event.groundStopReason,
    event.groundDelayReason,
    event.departureDelayReason,
    event.closureReason,
  ]
    .join(' ')
    .toLowerCase();

  if (reasonBlob.includes('thunderstorm')) {
    delayRisk += 8;
    cancelRisk += 10;
  }

  if (reasonBlob.includes('wind') || reasonBlob.includes('low ceiling')) {
    delayRisk += 6;
    cancelRisk += 4;
  }

  if (status.waitTimeSource !== 'none' && status.waitMinutes >= 30) {
    delayRisk += 4;
  }

  const nextStatus: AirportStatus = {
    ...status,
    delayRisk: clamp(delayRisk, 0, 95),
    cancelRisk: clamp(cancelRisk, 0, 85),
    riskSource: 'live',
    confidence: status.waitTimeSource === 'official' ? 'High' : 'Medium',
    dataSources: withUnique([...status.dataSources, 'FAA NAS Status']),
    note: fragments[0] ? fragments[0] : status.note,
    insight: fragments.length > 0 ? `${fragments.join('. ')}.` : status.insight,
    recommendation: status.recommendation,
  };

  return {
    ...nextStatus,
    recommendation: buildRecommendation(nextStatus),
  };
}

function describeReportedQueue(queueMinutes: number): string {
  if (queueMinutes >= 40) {
    return '40+ minute queues';
  }

  if (queueMinutes >= 20) {
    return '20 to 40 minute queues';
  }

  if (queueMinutes >= 10) {
    return '10 to 20 minute queues';
  }

  return 'light queues';
}

function applyCommunitySignals(status: AirportStatus, summary: ReportSummary): AirportStatus {
  if (!summary || summary.reportCount === 0) {
    return status;
  }

  const derivedWaitMinutes = summary.strongestQueueMinutes;
  const shouldUseCommunityWait = status.waitTimeSource === 'none' || derivedWaitMinutes > status.waitMinutes;
  const waitMinutes = shouldUseCommunityWait ? derivedWaitMinutes : status.waitMinutes;
  const waitTimeSource = shouldUseCommunityWait && status.waitTimeSource === 'none' ? 'community' : status.waitTimeSource;
  const crowdLevel = shouldUseCommunityWait ? getCrowdLevel(waitMinutes) : status.crowdLevel;
  const queueDelayRisk = shouldUseCommunityWait ? derivedQueueDelayRisk(waitMinutes) : status.delayRisk;
  const delayRisk = clamp(
    Math.max(status.delayRisk, queueDelayRisk) +
      Math.min(10, summary.busyReportCount * 2 + summary.packedReportCount * 4),
    0,
    95,
  );
  const cancelRisk = clamp(status.cancelRisk + Math.min(4, summary.packedReportCount * 2), 0, 85);
  const checkpointPhrase = summary.latestCheckpoint ? ` near ${summary.latestCheckpoint}` : '';
  const noteAddition = `Travelers recently reported ${describeReportedQueue(summary.strongestQueueMinutes)}${checkpointPhrase}.`;
  const insightAddition = summary.latestNote
    ? `Latest traveler note: "${summary.latestNote}".`
    : 'Fresh traveler reports are adding live community color to this airport picture.';
  const signals = [
    `${summary.reportCount} fresh traveler report${summary.reportCount === 1 ? '' : 's'}`,
  ];

  if (summary.photoCount > 0) {
    signals.push(`${summary.photoCount} fresh photo${summary.photoCount === 1 ? '' : 's'}`);
  }

  if (summary.packedReportCount > 0) {
    signals.push('Packed checkpoint reports');
  }

  const nextStatus: AirportStatus = {
    ...status,
    waitMinutes,
    waitDisplay: shouldUseCommunityWait ? formatDerivedWaitDisplay(waitMinutes) : status.waitDisplay,
    waitTimeSource,
    crowdLevel,
    delayRisk,
    cancelRisk,
    riskSource: status.riskSource === 'none' ? 'community' : status.riskSource,
    confidence: raiseConfidence(status.confidence),
    reports: status.reports + summary.reportCount,
    photos: status.photos + summary.photoCount,
    note: mergeSentence(status.note, noteAddition),
    insight: mergeSentence(status.insight, insightAddition),
    dataSources: withUnique([...status.dataSources, 'Airport Now traveler reports']),
    signals: withUnique([...status.signals, ...signals]),
  };

  return {
    ...nextStatus,
    recommendation: buildRecommendation(nextStatus),
  };
}

function airportSortGroup(status: AirportStatus): number {
  if (status.waitTimeSource === 'official') {
    return 0;
  }

  if (status.waitTimeSource === 'official_estimate') {
    return 1;
  }

  if (status.waitTimeSource === 'community') {
    return 2;
  }

  if (status.riskSource === 'live') {
    return 3;
  }

  return 4;
}

function sortAirports(airports: AirportStatus[]): AirportStatus[] {
  return [...airports].sort((left, right) => {
    const groupDelta = airportSortGroup(left) - airportSortGroup(right);

    if (groupDelta !== 0) {
      return groupDelta;
    }

    if (left.waitTimeSource !== 'none' || right.waitTimeSource !== 'none') {
      const waitDelta = right.waitMinutes - left.waitMinutes;

      if (waitDelta !== 0) {
        return waitDelta;
      }
    }

    const delayDelta = right.delayRisk - left.delayRisk;

    if (delayDelta !== 0) {
      return delayDelta;
    }

    const cancelDelta = right.cancelRisk - left.cancelRisk;

    if (cancelDelta !== 0) {
      return cancelDelta;
    }

    const signalDelta = right.signals.length - left.signals.length;

    if (signalDelta !== 0) {
      return signalDelta;
    }

    return AIRPORT_INDEX[left.code] - AIRPORT_INDEX[right.code];
  });
}

export async function getAirportSnapshot(): Promise<AirportsApiResponse> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }
  if (inFlightSnapshot) {
    return inFlightSnapshot;
  }

  const previousSnapshot = cache?.value ?? null;
  const request = (async (): Promise<AirportsApiResponse> => {
    const generatedAt = new Date().toISOString();
    let airports = buildSeedAirportStatuses(generatedAt).map((airport) => applyTravelPressureSignal(airport, generatedAt));

    const [
      faaResult,
      atlResult,
      bnaResult,
      denResult,
      mspResult,
      cltResult,
      cmhResult,
      cvgResult,
      dfwResult,
      dcaResult,
      iadResult,
      ewrResult,
      iahResult,
      laxResult,
      mcoResult,
      bwiResult,
      miaResult,
      phxResult,
      pdxResult,
      cleResult,
      dtwResult,
      jfkResult,
      phlResult,
      pitResult,
      slcResult,
      stlResult,
      chsResult,
      houResult,
      jaxResult,
      omaResult,
      satResult,
    ] =
      await Promise.allSettled([
        fetchFaaSnapshot(),
        fetchAtlWaitSnapshot(),
        fetchBnaWaitSnapshot(),
        fetchDenWaitSnapshot(),
        fetchMspWaitSnapshot(),
        fetchCltWaitSnapshot(),
        fetchCmhWaitSnapshot(),
        fetchCvgWaitSnapshot(),
        fetchDfwWaitSnapshot(),
        fetchDcaWaitSnapshot(),
        fetchIadWaitSnapshot(),
        fetchEwrWaitSnapshot(),
        fetchIahWaitSnapshot(),
        fetchLaxWaitSnapshot(),
        fetchMcoWaitSnapshot(),
        fetchBwiWaitSnapshot(),
        fetchMiaWaitSnapshot(),
        fetchPhxWaitSnapshot(),
        fetchPdxWaitSnapshot(),
        fetchCleWaitSnapshot(),
        fetchDtwWaitSnapshot(),
        fetchJfkWaitSnapshot(),
        fetchPhlWaitSnapshot(),
        fetchPitWaitSnapshot(),
        fetchSlcWaitSnapshot(),
        fetchStlWaitSnapshot(),
        fetchChsWaitSnapshot(),
        fetchHouWaitSnapshot(),
        fetchJaxWaitSnapshot(),
        fetchOmaWaitSnapshot(),
        fetchSatWaitSnapshot(),
      ]);

    if (atlResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'ATL'
          ? applyOfficialWait(airport, atlResult.value, {
              dataSource: 'ATL official security wait page',
              note: 'Official ATL checkpoint data is live.',
              insight: 'ATL wait data is being parsed from the official airport security wait page.',
            })
          : airport,
      );
    }

    if (bnaResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'BNA'
          ? applyOfficialWait(airport, bnaResult.value, {
              dataSource: 'BNA official homepage wait card',
              note: 'Official BNA security wait data is live.',
              insight: 'BNA wait data is being parsed from the live TSA wait card rendered on the airport homepage.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'BNA', now);
    }

  if (denResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'DEN'
        ? applyOfficialWait(airport, denResult.value, {
            dataSource: 'DEN official checkpoint wait API',
            note: 'Official DEN checkpoint data is live.',
            insight: 'DEN wait times are coming from the public TSA endpoint used by the airport security page.',
          })
        : airport,
    );
  }

  if (mspResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'MSP'
        ? applyOfficialWait(airport, mspResult.value, {
            dataSource: 'MSP official security wait page',
            note: 'Official MSP checkpoint data is live.',
            insight: 'This card is using the airport security page directly for checkpoint wait data.',
          })
        : airport,
    );
  }

    if (cltResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'CLT'
        ? applyOfficialWait(airport, cltResult.value, {
            dataSource: 'CLT official checkpoint wait API',
            note: 'Official CLT checkpoint data is live.',
            insight: 'Charlotte wait data is coming from the same checkpoint feed used on the public airport site.',
          })
        : airport,
    );
    }

    if (cmhResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'CMH'
          ? applyOfficialEstimateWait(airport, cmhResult.value, {
              dataSource: 'CMH official security page estimate',
              note: 'Official CMH checkpoint estimate is available.',
              insight: 'CMH publishes a current airport-wide checkpoint estimate plus a same-day forecast on its official security page, so Airport Now classifies it as an official estimate instead of a direct live checkpoint feed.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'CMH', now);
    }

    if (cvgResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'CVG'
          ? applyOfficialWait(airport, cvgResult.value, {
              dataSource: 'CVG official checkpoint API',
              note: 'Official CVG checkpoint data is live.',
              insight: 'CVG wait times are coming from the official checkpoint API used by the airport security page.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'CVG', now);
    }

  if (dfwResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'DFW'
        ? applyOfficialWait(airport, dfwResult.value, {
            dataSource: 'DFW official checkpoint wait API',
            note: 'Official DFW checkpoint data is live across terminals.',
            insight: 'DFW wait data is tied directly to the airport checkpoint feed.',
          })
        : airport,
    );
  }

  if (dcaResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'DCA'
        ? applyOfficialWait(airport, dcaResult.value, {
            dataSource: 'DCA official security wait endpoint',
            note: 'Official Reagan National checkpoint data is live.',
            insight: 'DCA wait times are coming from the airport security wait endpoint used on the public page.',
          })
        : airport,
    );
  }

  if (iadResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'IAD'
        ? applyOfficialWait(airport, iadResult.value, {
            dataSource: 'IAD official security wait endpoint',
            note: 'Official Dulles checkpoint data is live.',
            insight: 'IAD wait times are coming from the airport security wait endpoint used on the public page.',
          })
        : airport,
    );
  }

    if (ewrResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'EWR'
          ? applyOfficialWait(airport, ewrResult.value, {
              dataSource: 'EWR official security wait API',
              note: 'Official Newark checkpoint data is live.',
              insight: 'EWR wait times are coming from the official airport security API used by the public homepage.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'EWR', now);
    }

    if (iahResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'IAH'
          ? applyOfficialWait(airport, iahResult.value, {
              dataSource: 'IAH official security wait API',
              note: 'Official IAH checkpoint data is live.',
              insight: 'IAH wait times are coming from the official airport API that backs the public security page.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'IAH', now);
    }

  if (laxResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'LAX'
        ? applyOfficialWait(airport, laxResult.value, {
            dataSource: 'LAX official security wait page',
            note: 'Official LAX checkpoint data is live.',
            insight: 'LAX wait times are being parsed from the airport security table.',
          })
        : airport,
    );
  }

    if (mcoResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'MCO'
          ? applyOfficialWait(airport, mcoResult.value, {
              dataSource: 'MCO official security wait API',
              note: 'Official MCO checkpoint data is live.',
              insight: 'MCO wait times are coming from the official airport API used by the live security widget on the public homepage.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'MCO', now);
    }

  if (bwiResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'BWI'
        ? applyOfficialWait(airport, bwiResult.value, {
            dataSource: 'BWI official security widget',
            note: 'Official BWI checkpoint data is live from the airport homepage widget.',
            insight: 'BWI wait times are being parsed from the security widget rendered on the airport homepage.',
          })
        : airport,
    );
  }

  if (miaResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'MIA'
        ? applyOfficialWait(airport, miaResult.value, {
            dataSource: 'MIA official checkpoint API',
            note: 'Official MIA checkpoint data is live.',
            insight: 'MIA wait times are coming from the queue API used by the airport security page.',
          })
        : airport,
    );
  }

  if (phxResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'PHX'
        ? applyOfficialWait(airport, phxResult.value, {
            dataSource: 'PHX official checkpoint API',
            note: 'Official PHX checkpoint data is live.',
            insight: 'PHX wait times are coming from the public queue feed used on the airport website.',
          })
        : airport,
    );
  }

  if (pdxResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'PDX'
        ? applyOfficialWait(airport, pdxResult.value, {
            dataSource: 'PDX official checkpoint refresh endpoint',
            note: 'Official PDX checkpoint data is live.',
            insight: 'PDX wait times are coming from the same refresh endpoint used by the airport homepage widget.',
          })
        : airport,
    );
  }

  if (cleResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'CLE'
        ? applyOfficialWait(airport, cleResult.value, {
            dataSource: 'CLE official checkpoint level feed',
            note: 'Official CLE checkpoint level data is live.',
            insight: 'CLE publishes live checkpoint levels rather than exact minute counts, so Airport Now maps those official levels into approximate queue bands for ranking.',
          })
        : airport,
    );
  }

  if (dtwResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'DTW'
        ? applyOfficialWait(airport, dtwResult.value, {
            dataSource: 'DTW official security wait endpoint',
            note: 'Official DTW checkpoint data is live.',
            insight: 'DTW wait times are coming from the public terminal wait endpoint used by the airport homepage.',
          })
        : airport,
    );
  }

  if (jfkResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'JFK'
        ? applyOfficialWait(airport, jfkResult.value, {
            dataSource: 'JFK public security wait GraphQL endpoint',
            note: 'Official JFK checkpoint data is live.',
            insight: 'JFK wait times are coming from the public GraphQL endpoint used by the airport homepage.',
          })
        : airport,
    );
  }

    if (phlResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'PHL'
          ? applyOfficialWait(airport, phlResult.value, {
              dataSource: 'PHL official checkpoint metrics API',
              note: 'Official PHL checkpoint data is live.',
              insight: 'PHL wait times are coming from the metrics API configured in the airport checkpoint page script.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'PHL', now);
    }

    if (pitResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'PIT'
          ? applyOfficialWait(airport, pitResult.value, {
              dataSource: 'PIT official security page-backed API',
              note: 'Official PIT checkpoint data is live.',
              insight: 'PIT wait times are coming from the official airport API exposed through the public security page script.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'PIT', now);
    }

  if (slcResult.status === 'fulfilled') {
    airports = airports.map((airport) =>
      airport.code === 'SLC'
        ? applyOfficialWait(airport, slcResult.value, {
            dataSource: 'SLC official wait-times endpoint',
            note: 'Official SLC checkpoint data is live.',
            insight: 'SLC publishes an airport-wide live security estimate plus TSA PreCheck lane status through its official wait-times endpoint.',
          })
        : airport,
    );
  }

    if (stlResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'STL'
          ? applyOfficialEstimateWait(airport, stlResult.value, {
              dataSource: 'STL official on-page checkpoint estimate',
              note: 'Official STL checkpoint estimate is available.',
              insight: 'STL publishes a current on-page checkpoint estimate plus checkpoint status cards, so Airport Now classifies it as an official estimate instead of a direct live feed.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'STL', now);
    }

    if (chsResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'CHS'
          ? applyOfficialEstimateWait(airport, chsResult.value, {
              dataSource: 'CHS official security checkpoint page',
              note: 'Official CHS checkpoint estimates are available.',
              insight: 'CHS publishes current official checkpoint estimates plus an hourly forecast on the airport security page, so Airport Now classifies it as an official estimate source.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'CHS', now);
    }

    if (houResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'HOU'
          ? applyOfficialWait(airport, houResult.value, {
              dataSource: 'HOU official security wait API',
              note: 'Official HOU checkpoint data is live.',
              insight: 'HOU wait times are coming from the official Houston Airports API that backs the public Hobby security page.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'HOU', now);
    }

    if (jaxResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'JAX'
          ? applyOfficialEstimateWait(airport, jaxResult.value, {
              dataSource: 'JAX official checkpoint wait page',
              note: 'Official JAX checkpoint estimates are available.',
              insight: 'JAX publishes current checkpoint estimates with lane-level breakdowns on its official wait page, so Airport Now classifies it as an official estimate source.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'JAX', now);
    }

    if (omaResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'OMA'
          ? applyOfficialEstimateWait(airport, omaResult.value, {
              dataSource: 'OMA official security checkpoint page',
              note: 'Official OMA checkpoint estimates are available.',
              insight: 'OMA publishes current concourse-level checkpoint ranges on its official security page, so Airport Now classifies it as an official estimate source.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'OMA', now);
    }

    if (satResult.status === 'fulfilled') {
      airports = airports.map((airport) =>
        airport.code === 'SAT'
          ? applyOfficialEstimateWait(airport, satResult.value, {
              dataSource: 'SAT official security wait page',
              note: 'Official SAT checkpoint estimates are available.',
              insight: 'SAT publishes terminal-level security average wait times on its official security page, so Airport Now classifies it as an official estimate source.',
            })
          : airport,
      );
    } else {
      airports = reuseStaleOfficialWait(airports, previousSnapshot, 'SAT', now);
    }

    if (faaResult.status === 'fulfilled') {
      airports = airports.map((airport) => applyFaaRisk(airport, faaResult.value.eventsByAirport[airport.code]));
    }

    const reportSummaries = await getRecentReportSummaryByAirport(new Date(generatedAt));
    airports = airports.map((airport) => applyCommunitySignals(airport, reportSummaries[airport.code]));

    const value = {
      generatedAt,
      airports: sortAirports(airports).map((airport) => ({
        ...airport,
        recommendation: buildRecommendation(airport),
      })),
    };

    cache = {
      expiresAt: now + 60_000,
      value,
    };

    return value;
  })().finally(() => {
    inFlightSnapshot = null;
  });

  inFlightSnapshot = request;
  return request;
}

export function invalidateAirportSnapshotCache(): void {
  cache = null;
  inFlightSnapshot = null;
}
