import { RouteOption, WeatherSnapshot, Place, RouteSegment } from './types';

export const SEOUL_STATION: Place = {
  label: '서울역',
  subLabel: '서울특별시 용산구',
  coordinate: { latitude: 37.5547, longitude: 126.9707 },
};

export const EULJIRO: Place = {
  label: '을지로입구',
  subLabel: '서울특별시 중구',
  coordinate: { latitude: 37.5663, longitude: 126.9829 },
};

export const GANGNAM: Place = {
  label: '강남역',
  subLabel: '서울특별시 강남구',
  coordinate: { latitude: 37.498, longitude: 127.0276 },
};

export const MYEONGDONG: Place = {
  label: '명동입구',
  subLabel: '서울특별시 중구',
  coordinate: { latitude: 37.5641, longitude: 126.9851 },
};

export const HOT_WEATHER: WeatherSnapshot = {
  observedAt: '2026-09-10T14:00:00+09:00',
  temperatureC: 34,
  apparentTemperatureC: 38,
  humidityPct: 75,
  uvIndex: 8,
  windMps: 1.5,
  precipitationProbability: 10,
  source: 'KMA (demo)',
  dataQuality: 'demo',
};

export const MILD_WEATHER: WeatherSnapshot = {
  observedAt: '2026-09-10T09:00:00+09:00',
  temperatureC: 25,
  apparentTemperatureC: 26,
  humidityPct: 50,
  uvIndex: 3,
  windMps: 3.2,
  precipitationProbability: 0,
  source: 'KMA (demo)',
  dataQuality: 'demo',
};

export const WARM_WEATHER: WeatherSnapshot = {
  observedAt: '2026-09-10T18:00:00+09:00',
  temperatureC: 31,
  apparentTemperatureC: 35,
  humidityPct: 70,
  uvIndex: 2,
  windMps: 1.8,
  precipitationProbability: 20,
  source: 'KMA (demo)',
  dataQuality: 'demo',
};

function segWalk(min: number, from: string, to: string): RouteSegment {
  return { mode: 'walk', label: '도보', durationMin: min, outdoor: true, startName: from, endName: to };
}

function segMetro(min: number, from: string, to: string, label = '지하철 2호선'): RouteSegment {
  return { mode: 'subway', label, durationMin: min, outdoor: false, startName: from, endName: to };
}

function segBus(min: number, from: string, to: string, label = '버스 152번'): RouteSegment {
  return { mode: 'bus', label, durationMin: min, outdoor: false, startName: from, endName: to };
}

export const EULJIRO_TO_SEOUL_STATION: RouteOption[] = [
  {
    id: 'walk-1',
    mode: 'walk',
    label: '도보',
    durationMin: 35,
    walkMin: 35,
    waitMin: 0,
    transfers: 0,
    departureAt: '2026-09-10T13:15:00+09:00',
    arrivalAt: '2026-09-10T13:50:00+09:00',
    geometry: [
      { latitude: 37.5663, longitude: 126.9829 },
      { latitude: 37.5611, longitude: 126.9771 },
      { latitude: 37.5547, longitude: 126.9707 },
    ],
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [segWalk(35, '을지로입구', '서울역')],
  },
  {
    id: 'transit-1',
    mode: 'transit',
    label: '지하철 1호선',
    durationMin: 22,
    walkMin: 8,
    waitMin: 5,
    transfers: 0,
    departureAt: '2026-09-10T13:23:00+09:00',
    arrivalAt: '2026-09-10T13:45:00+09:00',
    geometry: [
      { latitude: 37.5663, longitude: 126.9829 },
      { latitude: 37.5700, longitude: 126.9870 },
      { latitude: 37.5600, longitude: 126.9750 },
      { latitude: 37.5547, longitude: 126.9707 },
    ],
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [
      segWalk(8, '을지로입구', '을지로입구역'),
      segMetro(9, '을지로입구역', '서울역', '지하철 1호선'),
    ],
  },
  {
    id: 'transit-2',
    mode: 'transit',
    label: '버스 152번',
    durationMin: 28,
    walkMin: 6,
    waitMin: 8,
    transfers: 0,
    departureAt: '2026-09-10T13:20:00+09:00',
    arrivalAt: '2026-09-10T13:48:00+09:00',
    geometry: [
      { latitude: 37.5663, longitude: 126.9829 },
      { latitude: 37.5580, longitude: 126.9780 },
      { latitude: 37.5547, longitude: 126.9707 },
    ],
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [
      segWalk(6, '을지로입구', '을지로입구 정류소'),
      segBus(14, '을지로입구 정류소', '서울역', '버스 152번'),
    ],
  },
];

export const EULJIRO_TO_MYEONGDONG: RouteOption[] = [
  {
    id: 'walk-md',
    mode: 'walk',
    label: '도보',
    durationMin: 12,
    walkMin: 12,
    waitMin: 0,
    transfers: 0,
    departureAt: '2026-09-10T13:48:00+09:00',
    arrivalAt: '2026-09-10T14:00:00+09:00',
    geometry: [
      { latitude: 37.5663, longitude: 126.9829 },
      { latitude: 37.5641, longitude: 126.9851 },
    ],
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [segWalk(12, '을지로입구', '명동입구')],
  },
  {
    id: 'transit-md',
    mode: 'transit',
    label: '지하철 4호선',
    durationMin: 18,
    walkMin: 3,
    waitMin: 3,
    transfers: 0,
    departureAt: '2026-09-10T13:40:00+09:00',
    arrivalAt: '2026-09-10T13:58:00+09:00',
    geometry: [
      { latitude: 37.5663, longitude: 126.9829 },
      { latitude: 37.5600, longitude: 126.9870 },
      { latitude: 37.5641, longitude: 126.9851 },
    ],
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [
      segWalk(3, '을지로입구', '을지로입구역'),
      segMetro(12, '을지로입구역', '명동역', '지하철 4호선'),
    ],
  },
  {
    id: 'bus-md',
    mode: 'transit',
    label: '버스 104번',
    durationMin: 24,
    walkMin: 6,
    waitMin: 6,
    transfers: 0,
    departureAt: '2026-09-10T13:36:00+09:00',
    arrivalAt: '2026-09-10T14:00:00+09:00',
    geometry: [
      { latitude: 37.5663, longitude: 126.9829 },
      { latitude: 37.5670, longitude: 126.9840 },
      { latitude: 37.5641, longitude: 126.9851 },
    ],
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [
      segWalk(6, '을지로입구', '을지로입구 정류소'),
      segBus(12, '을지로입구 정류소', '명동입구', '버스 104번'),
    ],
  },
];

export const EULJIRO_TO_GANGNAM: RouteOption[] = [
  {
    id: 'walk-gn',
    mode: 'walk',
    label: '도보',
    durationMin: 65,
    walkMin: 65,
    waitMin: 0,
    transfers: 0,
    departureAt: '2026-09-10T13:15:00+09:00',
    arrivalAt: '2026-09-10T14:20:00+09:00',
    geometry: [
      { latitude: 37.5663, longitude: 126.9829 },
      { latitude: 37.5320, longitude: 127.0050 },
      { latitude: 37.5050, longitude: 127.0180 },
      { latitude: 37.498, longitude: 127.0276 },
    ],
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [segWalk(65, '을지로입구', '강남역')],
  },
  {
    id: 'transit-gn-1',
    mode: 'transit',
    label: '지하철 2호선',
    durationMin: 25,
    walkMin: 7,
    waitMin: 4,
    transfers: 0,
    departureAt: '2026-09-10T13:21:00+09:00',
    arrivalAt: '2026-09-10T13:46:00+09:00',
    geometry: [
      { latitude: 37.5663, longitude: 126.9829 },
      { latitude: 37.5660, longitude: 126.9900 },
      { latitude: 37.5400, longitude: 126.9900 },
      { latitude: 37.498, longitude: 127.0276 },
    ],
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [
      segWalk(7, '을지로입구', '을지로입구역'),
      segMetro(14, '을지로입구역', '강남역', '지하철 2호선'),
    ],
  },
  {
    id: 'transit-gn-2',
    mode: 'transit',
    label: '버스 143번',
    durationMin: 32,
    walkMin: 10,
    waitMin: 7,
    transfers: 1,
    departureAt: '2026-09-10T13:18:00+09:00',
    arrivalAt: '2026-09-10T13:50:00+09:00',
    geometry: [
      { latitude: 37.5663, longitude: 126.9829 },
      { latitude: 37.5500, longitude: 126.9950 },
      { latitude: 37.5100, longitude: 127.0100 },
      { latitude: 37.498, longitude: 127.0276 },
    ],
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [
      segWalk(5, '을지로입구', '을지로입구 정류소'),
      segBus(15, '을지로입구 정류소', '신논현 정류소', '버스 143번'),
      segWalk(5, '신논현 정류소', '강남역'),
    ],
  },
];