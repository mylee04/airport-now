export type TrafficAircraft = {
  id: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  altitudeMeters: number | null;
  velocityMetersPerSecond: number | null;
  onGround: boolean;
};

export type TrafficApiResponse = {
  generatedAt: string;
  airborneCount: number;
  sampleCount: number;
  aircraft: TrafficAircraft[];
};
