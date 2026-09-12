export type Coordinate = { latitude: number; longitude: number };

/**
 * Normalized place. `label` is a short Korean display name (e.g. 서울역,
 * 판교역, 고양시청). `subLabel` carries the Korean administrative context
 * (e.g. 서울특별시 중구) so the UI can render "서울역 · 서울특별시 중구"
 * without leaking provider address strings.
 */
export type Place = {
  label: string;
  subLabel?: string;
  coordinate: Coordinate;
  source?: string;
  /** GPS horizontal accuracy in meters (browser geolocation only). */
  accuracy?: number;
};

/**
 * Quality of a data point.
 * - live:      fetched this request from the provider
 * - estimated: derived with documented conservative assumptions
 * - demo:      deterministic fallback fixture, never silently mixed with live
 */
export type DataQuality = 'live' | 'estimated' | 'demo';

export type WeatherSnapshot = {
  observedAt: string; // ISO 8601 with +09:00 offset (Asia/Seoul)
  temperatureC: number;
  apparentTemperatureC?: number;
  humidityPct?: number;
  /** 0–11+ UV index from provider when available */
  uvIndex?: number;
  windMps?: number;
  precipitationProbability?: number; // 0–100
  source: string; // provider name, e.g. 'Open-Meteo' | 'KMA'
  dataQuality: DataQuality;
};

export type RouteSegmentMode = 'walk' | 'bus' | 'subway' | 'train' | 'car';

/** One leg of a route. `outdoor` marks segments that count toward heat exposure. */
export type RouteSegment = {
  mode: RouteSegmentMode;
  label: string; // '도보' | '지하철 2호선' | '버스 143번'
  durationMin: number;
  outdoor: boolean;
  startName?: string;
  endName?: string;
  geometry?: Coordinate[];
};

export type RouteOption = {
  id: string;
  mode: 'walk' | 'transit' | 'car';
  label: string;
  durationMin: number;
  /** total walking minutes (access + transfer + egress) */
  walkMin: number;
  /** total waiting minutes (boarding + transfer waiting) */
  waitMin: number;
  transfers: number;
  geometry?: Coordinate[];
  departureAt: string; // ISO 8601 +09:00
  arrivalAt: string; // ISO 8601 +09:00
  source: string; // provider name, e.g. 'ODsay' | 'OSRM'
  dataQuality: DataQuality;
  segments?: RouteSegment[];
};

/** Fine-grained, Korea-aware outdoor/indoor breakdown. */
export type ExposureBreakdown = {
  /** time physically walking outdoors */
  walkingOutdoorMin: number;
  /** time waiting outdoors (bus stop, street) */
  waitingOutdoorMin: number;
  /** time waiting in a sheltered station/stop */
  waitingShelteredMin: number;
  /** out-of-vehicle transfer walking outdoors */
  transferOutdoorMin: number;
  /** time inside vehicles/stations (subway, indoor transit) */
  indoorMin: number;
};

export type ScoredOption = RouteOption & {
  outdoorExposureMin: number;
  heatIntensity: number; // normalized 0–100
  heatBurden: number; // normalized 0–100
  decisionScore: number; // lower is better
  reasons: string[];
  exposure?: ExposureBreakdown;
};

export type Recommendation = {
  recommended: ScoredOption;
  fastestBaseline: ScoredOption;
  alternatives: ScoredOption[];
  assumptions: string[];
  dataStatus: 'live' | 'partial' | 'demo';
};

export type Timings = {
  geocodingMs?: number;
  weatherMs?: number;
  walkingMs?: number;
  transitMs?: number;
  drivingMs?: number;
  decisionEngineMs?: number;
  totalMs?: number;
};