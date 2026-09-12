import { Place, RouteOption } from '../domain/types';

/**
 * Ten reproducible Korea scenarios for the Decision Engine.
 *
 * Durations/labels are deterministic demo-quality inputs (dataQuality: 'demo')
 * so the engine can be exercised offline across the seven major metros without
 * any live provider. Coordinates are approximaate and only used as metadata.
 */

export type Scenario = {
  id: string;
  name: string;
  city: string;
  origin: Place;
  destination: Place;
  routes: RouteOption[];
};

function p(label: string, subLabel: string, lat: number, lon: number): Place {
  return { label, subLabel, coordinate: { latitude: lat, longitude: lon } };
}

/** Wall-clock ISO (+09:00) for a demo trip started at 14:00 KST. */
function demoArrival(durationMin: number): string {
  const total = 14 * 60 + durationMin;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `2026-09-10T${hh}:${mm}:00+09:00`;
}

function walk(id: string, label: string, minutes: number, from: string, to: string): RouteOption {
  return {
    id,
    mode: 'walk',
    label,
    durationMin: minutes,
    walkMin: minutes,
    waitMin: 0,
    transfers: 0,
    departureAt: '2026-09-10T14:00:00+09:00',
    arrivalAt: demoArrival(minutes),
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [{ mode: 'walk', label: '도보', durationMin: minutes, outdoor: true, startName: from, endName: to }],
  };
}

function transit(
  id: string,
  label: string,
  durationMin: number,
  walkMin: number,
  waitMin: number,
  transfer: number,
  segments: Array<{ mode: 'walk' | 'subway' | 'bus' | 'train'; label: string; min: number; from?: string; to?: string }>,
): RouteOption {
  const lines = segments
    .filter((s) => s.mode !== 'walk')
    .map((s) => s.label)
    .join(' → ');
  return {
    id,
    mode: 'transit',
    label: lines || label,
    durationMin,
    walkMin,
    waitMin,
    transfers: transfer,
    departureAt: '2026-09-10T14:00:00+09:00',
    arrivalAt: demoArrival(durationMin),
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: segments.map((s) => ({
      mode: s.mode,
      label: s.mode === 'walk' ? '도보' : s.label,
      durationMin: s.min,
      outdoor: s.mode === 'walk',
      startName: s.from,
      endName: s.to,
    })),
  };
}

function car(id: string, minutes: number, from: string, to: string): RouteOption {
  return {
    id,
    mode: 'car',
    label: '자동차',
    durationMin: minutes,
    walkMin: 0,
    waitMin: 0,
    transfers: 0,
    departureAt: '2026-09-10T14:00:00+09:00',
    arrivalAt: demoArrival(minutes),
    source: '데모 시나리오',
    dataQuality: 'demo',
    segments: [{ mode: 'car', label: '자동차', durationMin: minutes, outdoor: false, startName: from, endName: to }],
  };
}

export const KOREA_SCENARIOS: Scenario[] = [
  {
    id: 'seoul-seoulstation-gangnam',
    name: '서울역 → 강남역',
    city: '서울',
    origin: p('서울역', '서울특별시 용산구', 37.5547, 126.9707),
    destination: p('강남역', '서울특별시 강남구', 37.498, 127.0276),
    routes: [
      transit('s1-metro', '지하철 1호선 → 지하철 2호선', 33, 10, 5, 1, [
        { mode: 'walk', label: '도보', min: 6, from: '서울역', to: '서울역(1호선)' },
        { mode: 'subway', label: '지하철 1호선', min: 5, from: '서울역', to: '시청역' },
        { mode: 'walk', label: '환승', min: 4, from: '시청역', to: '시청역(2호선)' },
        { mode: 'subway', label: '지하철 2호선', min: 13, from: '시청역', to: '강남역' },
      ]),
      transit('s1-bus', '버스 402번', 45, 18, 10, 0, [
        { mode: 'walk', label: '도보', min: 9, from: '서울역', to: '서울역 버스정류소' },
        { mode: 'bus', label: '버스 402번', min: 18, from: '서울역 버스정류소', to: '강남역 버스정류소' },
        { mode: 'walk', label: '도보', min: 9, from: '강남역 버스정류소', to: '강남역' },
      ]),
      car('s1-car', 22, '서울역', '강남역'),
      walk('s1-walk', '도보', 70, '서울역', '강남역'),
    ],
  },
  {
    id: 'seoul-euljiro-gangnam',
    name: '을지로입구 → 강남역',
    city: '서울',
    origin: p('을지로입구', '서울특별시 중구', 37.5663, 126.9829),
    destination: p('강남역', '서울특별시 강남구', 37.498, 127.0276),
    routes: [
      transit('s2-metro', '지하철 2호선', 25, 7, 4, 0, [
        { mode: 'walk', label: '도보', min: 7 },
        { mode: 'subway', label: '지하철 2호선', min: 14 },
      ]),
      transit('s2-bus1', '버스 143번', 32, 10, 7, 1, [
        { mode: 'walk', label: '도보', min: 5 },
        { mode: 'bus', label: '버스 143번', min: 15 },
        { mode: 'walk', label: '환승', min: 5 },
        { mode: 'bus', label: '버스 471번', min: 2 },
      ]),
      walk('s2-walk', '도보', 65, '을지로입구', '강남역'),
    ],
  },
  {
    id: 'seoul-pangyo-gangnam',
    name: '판교역 → 강남역',
    city: '서울/경기',
    origin: p('판교역', '경기도 성남시 분당구', 37.395, 127.111),
    destination: p('강남역', '서울특별시 강남구', 37.498, 127.0276),
    routes: [
      transit('s3-metro', '신분당선', 23, 8, 5, 0, [
        { mode: 'walk', label: '도보', min: 5 },
        { mode: 'subway', label: '신분당선', min: 10 },
      ]),
      walk('s3-walk', '도보', 55, '판교역', '강남역'),
    ],
  },
  {
    id: 'busan-busanstation-seomyeon',
    name: '부산역 → 서면역',
    city: '부산',
    origin: p('부산역', '부산광역시 동구', 35.115, 129.041),
    destination: p('서면역', '부산광역시 부산진구', 35.157, 129.059),
    routes: [
      transit('s4-metro', '지하철 1호선', 14, 4, 3, 0, [
        { mode: 'walk', label: '도보', min: 2 },
        { mode: 'subway', label: '지하철 1호선', min: 9 },
        { mode: 'walk', label: '도보', min: 2 },
      ]),
      walk('s4-walk', '도보', 24, '부산역', '서면역'),
    ],
  },
  {
    id: 'busan-haeundae-centum',
    name: '해운대역 → 센텀시티역',
    city: '부산',
    origin: p('해운대역', '부산광역시 해운대구', 35.165, 129.159),
    destination: p('센텀시티역', '부산광역시 해운대구', 35.168, 129.130),
    routes: [
      transit('s5-metro', '지하철 2호선', 12, 4, 3, 0, [
        { mode: 'walk', label: '도보', min: 2 },
        { mode: 'subway', label: '지하철 2호선', min: 8 },
        { mode: 'walk', label: '도보', min: 2 },
      ]),
      walk('s5-walk', '도보', 40, '해운대역', '센텀시티역'),
    ],
  },
  {
    id: 'daejeon-daejeonstation-cityhall',
    name: '대전역 → 대전시청',
    city: '대전',
    origin: p('대전역', '대전광역시 동구', 36.334, 127.435),
    destination: p('대전시청', '대전광역시 서구', 36.35, 127.388),
    routes: [
      transit('s6-metro', '지하철 1호선', 20, 8, 5, 0, [
        { mode: 'walk', label: '도보', min: 4 },
        { mode: 'subway', label: '지하철 1호선', min: 12 },
        { mode: 'walk', label: '도보', min: 4 },
      ]),
      walk('s6-walk', '도보', 42, '대전역', '대전시청'),
    ],
  },
  {
    id: 'daegu-dongdaegu-midmarketchungang',
    name: '동대구역 → 중앙로역',
    city: '대구',
    origin: p('동대구역', '대구광역시 동구', 35.877, 128.628),
    destination: p('중앙로역', '대구광역시 중구', 35.873, 128.596),
    routes: [
      transit('s7-metro', '지하철 1호선', 16, 6, 4, 0, [
        { mode: 'walk', label: '도보', min: 3 },
        { mode: 'subway', label: '지하철 1호선', min: 10 },
        { mode: 'walk', label: '도보', min: 3 },
      ]),
      walk('s7-walk', '도보', 34, '동대구역', '중앙로역'),
    ],
  },
  {
    id: 'incheon-incheon-bupyeong',
    name: '인천역 → 부평역',
    city: '인천',
    origin: p('인천역', '인천광역시 중구', 37.476, 126.624),
    destination: p('부평역', '인천광역시 부평구', 37.489, 126.725),
    routes: [
      transit('s8-metro', '지하철 1호선 → 지하철 2호선', 40, 12, 8, 1, [
        { mode: 'walk', label: '도보', min: 6 },
        { mode: 'subway', label: '지하철 1호선', min: 24 },
        { mode: 'walk', label: '환승', min: 6 },
        { mode: 'subway', label: '지하철 1호선', min: 4 },
      ]),
      walk('s8-walk', '도보', 55, '인천역', '부평역'),
    ],
  },
  {
    id: 'gwangju-gwangjusongjeong-sangmu',
    name: '광주송정역 → 상무역',
    city: '광주',
    origin: p('광주송정역', '광주광역시 광산구', 35.139, 126.79),
    destination: p('상무역', '광주광역시 서구', 35.15, 126.84),
    routes: [
      transit('s9-metro', '지하철 1호선', 18, 6, 4, 0, [
        { mode: 'walk', label: '도보', min: 3 },
        { mode: 'subway', label: '지하철 1호선', min: 12 },
        { mode: 'walk', label: '도보', min: 3 },
      ]),
      walk('s9-walk', '도보', 38, '광주송정역', '상무역'),
    ],
  },
  {
    id: 'jeju-airport-cityhall',
    name: '제주공항 → 제주시청',
    city: '제주',
    origin: p('제주국제공항', '제주특별자치도 제주시', 33.51, 126.49),
    destination: p('제주시청', '제주특별자치도 제주시', 33.51, 126.53),
    routes: [
      transit('s10-bus', '버스 100번', 22, 10, 8, 0, [
        { mode: 'walk', label: '도보', min: 5 },
        { mode: 'bus', label: '버스 100번', min: 12 },
        { mode: 'walk', label: '도보', min: 5 },
      ]),
      walk('s10-walk', '도보', 45, '제주공항', '제주시청'),
    ],
  },
];