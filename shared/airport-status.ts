export const AIRPORT_CODES = [
  'ATL',
  'ABQ',
  'AUS',
  'BNA',
  'BOS',
  'BWI',
  'CLE',
  'CLT',
  'CMH',
  'CVG',
  'DCA',
  'DEN',
  'DFW',
  'DTW',
  'EWR',
  'FLL',
  'IAD',
  'IAH',
  'IND',
  'JFK',
  'LAS',
  'LAX',
  'MCI',
  'MCO',
  'MDW',
  'MIA',
  'MSP',
  'OAK',
  'ORD',
  'PDX',
  'PHL',
  'PHX',
  'PIT',
  'RDU',
  'SAN',
  'SEA',
  'SFO',
  'SJC',
  'SLC',
  'STL',
  'TPA',
] as const;

export type AirportCode = (typeof AIRPORT_CODES)[number];
export type CrowdLevel = 'Unknown' | 'Low' | 'Medium' | 'High' | 'Severe';
export type Confidence = 'High' | 'Medium' | 'Low';
export type WaitTimeSource = 'official' | 'community' | 'none';
export type RiskSource = 'live' | 'community' | 'none';
export type CheckpointStatus = 'Open' | 'Closed' | 'PreCheck Only';
export type CheckpointSource = 'official' | 'community';

export type AirportCheckpoint = {
  id: string;
  name: string;
  terminal: string;
  status: CheckpointStatus;
  waitMinutes: number | null;
  displayWait: string;
  message: string;
  source: CheckpointSource;
};

export type AirportStatus = {
  code: AirportCode;
  name: string;
  city: string;
  waitMinutes: number;
  waitDisplay: string;
  waitTimeSource: WaitTimeSource;
  crowdLevel: CrowdLevel;
  confidence: Confidence;
  delayRisk: number;
  cancelRisk: number;
  riskSource: RiskSource;
  updatedAt: string;
  reports: number;
  photos: number;
  note: string;
  insight: string;
  recommendation: string;
  checkpoints: AirportCheckpoint[];
  dataSources: string[];
  signals: string[];
};

export type AirportsApiResponse = {
  generatedAt: string;
  airports: AirportStatus[];
};

export type AirportDefinition = {
  code: AirportCode;
  name: string;
  city: string;
  icaoCode: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

export const AIRPORT_METADATA: AirportDefinition[] = [
  { code: 'ATL', name: 'Hartsfield-Jackson', city: 'Atlanta, GA', icaoCode: 'KATL', latitude: 33.6407, longitude: -84.4277, timeZone: 'America/New_York' },
  { code: 'ABQ', name: 'Albuquerque International Sunport', city: 'Albuquerque, NM', icaoCode: 'KABQ', latitude: 35.0402, longitude: -106.6092, timeZone: 'America/Denver' },
  { code: 'AUS', name: 'Austin-Bergstrom', city: 'Austin, TX', icaoCode: 'KAUS', latitude: 30.1975, longitude: -97.6664, timeZone: 'America/Chicago' },
  { code: 'BNA', name: 'Nashville International', city: 'Nashville, TN', icaoCode: 'KBNA', latitude: 36.1245, longitude: -86.6782, timeZone: 'America/Chicago' },
  { code: 'BOS', name: 'Boston Logan', city: 'Boston, MA', icaoCode: 'KBOS', latitude: 42.3656, longitude: -71.0096, timeZone: 'America/New_York' },
  { code: 'BWI', name: 'Baltimore/Washington', city: 'Baltimore, MD', icaoCode: 'KBWI', latitude: 39.1754, longitude: -76.6684, timeZone: 'America/New_York' },
  { code: 'CLE', name: 'Cleveland Hopkins', city: 'Cleveland, OH', icaoCode: 'KCLE', latitude: 41.4117, longitude: -81.8498, timeZone: 'America/New_York' },
  { code: 'CLT', name: 'Charlotte Douglas', city: 'Charlotte, NC', icaoCode: 'KCLT', latitude: 35.2144, longitude: -80.9473, timeZone: 'America/New_York' },
  { code: 'CMH', name: 'John Glenn Columbus', city: 'Columbus, OH', icaoCode: 'KCMH', latitude: 39.998, longitude: -82.8919, timeZone: 'America/New_York' },
  { code: 'CVG', name: 'Cincinnati/Northern Kentucky', city: 'Cincinnati, KY', icaoCode: 'KCVG', latitude: 39.0488, longitude: -84.6678, timeZone: 'America/New_York' },
  { code: 'DCA', name: 'Reagan National', city: 'Washington, DC', icaoCode: 'KDCA', latitude: 38.8512, longitude: -77.0402, timeZone: 'America/New_York' },
  { code: 'DEN', name: 'Denver International', city: 'Denver, CO', icaoCode: 'KDEN', latitude: 39.8561, longitude: -104.6737, timeZone: 'America/Denver' },
  { code: 'DFW', name: 'Dallas Fort Worth', city: 'Dallas, TX', icaoCode: 'KDFW', latitude: 32.8998, longitude: -97.0403, timeZone: 'America/Chicago' },
  { code: 'DTW', name: 'Detroit Metro', city: 'Detroit, MI', icaoCode: 'KDTW', latitude: 42.2124, longitude: -83.3534, timeZone: 'America/New_York' },
  { code: 'EWR', name: 'Newark Liberty', city: 'Newark, NJ', icaoCode: 'KEWR', latitude: 40.6895, longitude: -74.1745, timeZone: 'America/New_York' },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood', city: 'Fort Lauderdale, FL', icaoCode: 'KFLL', latitude: 26.0726, longitude: -80.1527, timeZone: 'America/New_York' },
  { code: 'IAD', name: 'Washington Dulles', city: 'Washington, DC', icaoCode: 'KIAD', latitude: 38.9531, longitude: -77.4565, timeZone: 'America/New_York' },
  { code: 'IAH', name: 'George Bush Intercontinental', city: 'Houston, TX', icaoCode: 'KIAH', latitude: 29.9902, longitude: -95.3368, timeZone: 'America/Chicago' },
  { code: 'IND', name: 'Indianapolis International', city: 'Indianapolis, IN', icaoCode: 'KIND', latitude: 39.7173, longitude: -86.2944, timeZone: 'America/New_York' },
  { code: 'JFK', name: 'John F. Kennedy', city: 'New York, NY', icaoCode: 'KJFK', latitude: 40.6413, longitude: -73.7781, timeZone: 'America/New_York' },
  { code: 'LAS', name: 'Harry Reid', city: 'Las Vegas, NV', icaoCode: 'KLAS', latitude: 36.084, longitude: -115.1537, timeZone: 'America/Los_Angeles' },
  { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles, CA', icaoCode: 'KLAX', latitude: 33.9416, longitude: -118.4085, timeZone: 'America/Los_Angeles' },
  { code: 'MCI', name: 'Kansas City International', city: 'Kansas City, MO', icaoCode: 'KMCI', latitude: 39.2976, longitude: -94.7139, timeZone: 'America/Chicago' },
  { code: 'MCO', name: 'Orlando International', city: 'Orlando, FL', icaoCode: 'KMCO', latitude: 28.4312, longitude: -81.3081, timeZone: 'America/New_York' },
  { code: 'MDW', name: 'Chicago Midway', city: 'Chicago, IL', icaoCode: 'KMDW', latitude: 41.7868, longitude: -87.7522, timeZone: 'America/Chicago' },
  { code: 'MIA', name: 'Miami International', city: 'Miami, FL', icaoCode: 'KMIA', latitude: 25.7959, longitude: -80.287, timeZone: 'America/New_York' },
  { code: 'MSP', name: 'Minneapolis-Saint Paul', city: 'Minneapolis, MN', icaoCode: 'KMSP', latitude: 44.8848, longitude: -93.2223, timeZone: 'America/Chicago' },
  { code: 'OAK', name: 'Oakland International', city: 'Oakland, CA', icaoCode: 'KOAK', latitude: 37.7126, longitude: -122.2197, timeZone: 'America/Los_Angeles' },
  { code: 'ORD', name: "Chicago O'Hare", city: 'Chicago, IL', icaoCode: 'KORD', latitude: 41.9742, longitude: -87.9073, timeZone: 'America/Chicago' },
  { code: 'PDX', name: 'Portland International', city: 'Portland, OR', icaoCode: 'KPDX', latitude: 45.5898, longitude: -122.5951, timeZone: 'America/Los_Angeles' },
  { code: 'PHL', name: 'Philadelphia International', city: 'Philadelphia, PA', icaoCode: 'KPHL', latitude: 39.8744, longitude: -75.2424, timeZone: 'America/New_York' },
  { code: 'PHX', name: 'Phoenix Sky Harbor', city: 'Phoenix, AZ', icaoCode: 'KPHX', latitude: 33.4342, longitude: -112.0116, timeZone: 'America/Phoenix' },
  { code: 'PIT', name: 'Pittsburgh International', city: 'Pittsburgh, PA', icaoCode: 'KPIT', latitude: 40.4915, longitude: -80.2329, timeZone: 'America/New_York' },
  { code: 'RDU', name: 'Raleigh-Durham', city: 'Raleigh, NC', icaoCode: 'KRDU', latitude: 35.8776, longitude: -78.7875, timeZone: 'America/New_York' },
  { code: 'SAN', name: 'San Diego International', city: 'San Diego, CA', icaoCode: 'KSAN', latitude: 32.7338, longitude: -117.1933, timeZone: 'America/Los_Angeles' },
  { code: 'SEA', name: 'Seattle-Tacoma', city: 'Seattle, WA', icaoCode: 'KSEA', latitude: 47.4502, longitude: -122.3088, timeZone: 'America/Los_Angeles' },
  { code: 'SFO', name: 'San Francisco International', city: 'San Francisco, CA', icaoCode: 'KSFO', latitude: 37.6213, longitude: -122.379, timeZone: 'America/Los_Angeles' },
  { code: 'SJC', name: 'San Jose Mineta', city: 'San Jose, CA', icaoCode: 'KSJC', latitude: 37.3639, longitude: -121.9289, timeZone: 'America/Los_Angeles' },
  { code: 'SLC', name: 'Salt Lake City International', city: 'Salt Lake City, UT', icaoCode: 'KSLC', latitude: 40.7899, longitude: -111.9791, timeZone: 'America/Denver' },
  { code: 'STL', name: 'St. Louis Lambert', city: 'St. Louis, MO', icaoCode: 'KSTL', latitude: 38.7487, longitude: -90.37, timeZone: 'America/Chicago' },
  { code: 'TPA', name: 'Tampa International', city: 'Tampa, FL', icaoCode: 'KTPA', latitude: 27.9755, longitude: -82.5332, timeZone: 'America/New_York' },
];

export function getCrowdLevel(waitMinutes: number): CrowdLevel {
  if (waitMinutes >= 40) {
    return 'Severe';
  }

  if (waitMinutes >= 25) {
    return 'High';
  }

  if (waitMinutes >= 15) {
    return 'Medium';
  }

  if (waitMinutes > 0) {
    return 'Low';
  }

  return 'Unknown';
}

export function buildSeedAirportStatuses(nowIso = new Date().toISOString()): AirportStatus[] {
  return AIRPORT_METADATA.map((airport) => ({
    code: airport.code,
    name: airport.name,
    city: airport.city,
    waitMinutes: 0,
    waitDisplay: 'No live checkpoint feed',
    waitTimeSource: 'none',
    crowdLevel: 'Unknown',
    confidence: 'Low',
    delayRisk: 0,
    cancelRisk: 0,
    riskSource: 'none',
    updatedAt: nowIso,
    reports: 0,
    photos: 0,
    note: 'This airport does not publish a live checkpoint wait feed yet.',
    insight: 'Watching official airport wait feeds, FAA NAS status, and traveler reports for this airport.',
    recommendation: 'Use airline alerts and airport guidance until a live checkpoint source is available.',
    checkpoints: [],
    dataSources: [],
    signals: [],
  }));
}
