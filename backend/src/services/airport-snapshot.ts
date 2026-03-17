import {
  AIRPORT_CODES,
  buildSeedAirportStatuses,
  getCrowdLevel,
  type AirportCode,
  type AirportsApiResponse,
  type AirportStatus,
} from '../../../shared/airport-status';
import { fetchAtlWaitSnapshot } from '../adapters/atl';
import { fetchBwiWaitSnapshot } from '../adapters/bwi';
import { fetchCltWaitSnapshot } from '../adapters/clt';
import { fetchDcaWaitSnapshot, fetchIadWaitSnapshot } from '../adapters/mwaa';
import { fetchDenWaitSnapshot } from '../adapters/den';
import { fetchDfwWaitSnapshot } from '../adapters/dfw';
import { fetchFaaSnapshot } from '../adapters/faa';
import { fetchLaxWaitSnapshot } from '../adapters/lax';
import { fetchMiaWaitSnapshot } from '../adapters/mia';
import { fetchMspWaitSnapshot } from '../adapters/msp';
import { getRecentReportSummaryByAirport } from './report-store';
import { getTravelPressure } from './travel-pressure';

type SnapshotCache = {
  expiresAt: number;
  value: AirportsApiResponse;
};

type FaaAirportEvent = Awaited<ReturnType<typeof fetchFaaSnapshot>>['eventsByAirport'][AirportCode];
type ReportSummary = Awaited<ReturnType<typeof getRecentReportSummaryByAirport>>[AirportCode];
type OfficialWaitSnapshot = {
  fetchedAt: string;
  waitMinutes: number;
  waitDisplay: string;
  checkpoints: AirportStatus['checkpoints'];
};

let cache: SnapshotCache | null = null;
const AIRPORT_INDEX = Object.fromEntries(
  AIRPORT_CODES.map((code, index) => [code, index]),
) as Record<AirportCode, number>;

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

  if (status.waitTimeSource === 'official' || status.waitTimeSource === 'community') {
    if (status.waitMinutes >= 25) {
      return `Checkpoint demand is elevated at ${status.code}. Add extra buffer before you head to the airport.`;
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
  snapshot: OfficialWaitSnapshot,
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

  if (status.waitTimeSource === 'community') {
    return 1;
  }

  if (status.riskSource === 'live') {
    return 2;
  }

  return 3;
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

  const generatedAt = new Date().toISOString();
  let airports = buildSeedAirportStatuses(generatedAt).map((airport) => applyTravelPressureSignal(airport, generatedAt));

  const [faaResult, atlResult, denResult, mspResult, cltResult, dfwResult, dcaResult, iadResult, laxResult, bwiResult, miaResult] =
    await Promise.allSettled([
      fetchFaaSnapshot(),
      fetchAtlWaitSnapshot(),
      fetchDenWaitSnapshot(),
      fetchMspWaitSnapshot(),
      fetchCltWaitSnapshot(),
      fetchDfwWaitSnapshot(),
      fetchDcaWaitSnapshot(),
      fetchIadWaitSnapshot(),
      fetchLaxWaitSnapshot(),
      fetchBwiWaitSnapshot(),
      fetchMiaWaitSnapshot(),
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
}

export function invalidateAirportSnapshotCache(): void {
  cache = null;
}
