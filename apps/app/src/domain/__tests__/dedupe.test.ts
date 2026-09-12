import { RouteOption } from '../types';
import { dedupeTransitOptions } from '../dedupe';

function transit(id: string, label: string, durationMin: number, walkMin = 0): RouteOption {
  const segLines = label.split('→').map((l) => l.trim());
  const segments = segLines.map((l, i) => ({
    mode: i === 0 ? 'bus' : 'bus',
    label: l.startsWith('지하철') ? l : `버스 ${l}`,
    durationMin: 5,
    outdoor: false,
    startName: `st${i}`,
    endName: `st${i + 1}`,
    distance: 1000,
  }));
  const segments2 = segLines.map((l) => ({
    mode: 'bus' as const,
    label: l.startsWith('지하철') ? l : `버스 ${l}`,
    durationMin: 5,
    outdoor: false,
    startName: 'a',
    endName: 'b',
    distance: 500,
  }));
  return {
    id,
    mode: 'transit',
    label: segLines.map((l) => (l.startsWith('지하철') ? l : `버스 ${l}`)).join(' → '),
    durationMin,
    walkMin,
    waitMin: 0,
    transfers: segLines.length - 1,
    departureAt: '2026-09-12T17:00:00+09:00',
    arrivalAt: '2026-09-12T18:00:00+09:00',
    source: '서울시 대중교통실시간',
    dataQuality: 'live',
    segments: segments2,
  };
}

const car: RouteOption = {
  id: 'car-1',
  mode: 'car',
  label: '자동차',
  durationMin: 20,
  walkMin: 0,
  waitMin: 0,
  transfers: 0,
  departureAt: '2026-09-12T17:40:00+09:00',
  arrivalAt: '2026-09-12T18:00:00+09:00',
  source: 'Kakao Navi',
  dataQuality: 'live',
};

test('exact duplicate chains collapse to one', () => {
  const a = transit('a', '9000성남 → 144', 34);
  const dup = transit('b', '9000성남 → 144', 34);
  const out = dedupeTransitOptions([a, dup]);
  expect(out.map((r) => r.id)).toEqual(['a']);
});

test('routes sharing a tail within tolerance keep the first', () => {
  const first = transit('a', '9000성남 → 144', 34);
  const sameTail = transit('b', '5500-2용인 → 144', 34);
  const sameTail2 = transit('c', '8100예용인 → 144', 34);
  const out = dedupeTransitOptions([first, sameTail, sameTail2]);
  expect(out.map((r) => r.id)).toEqual(['a']);
});

test('different tails are all kept', () => {
  const r1 = transit('a', '9000성남 → 144', 34);
  const r2 = transit('b', '5005거용인 → 420', 34);
  const r3 = transit('c', '9000성남 → 140', 33);
  const out = dedupeTransitOptions([r1, r2, r3]);
  expect(out.length).toBe(3);
});

test('tail dedupe does not merge meaningfully slower routes', () => {
  const fast = transit('a', '9000성남 → 144', 34);
  const slow = transit('b', '서울역 순환 → 144', 60);
  const out = dedupeTransitOptions([fast, slow]);
  expect(out.map((r) => r.id)).toEqual(['a', 'b']);
});

test('non-transit routes pass through untouched', () => {
  const walk: RouteOption = {
    id: 'walk-1',
    mode: 'walk',
    label: '도보',
    durationMin: 100,
    walkMin: 100,
    waitMin: 0,
    transfers: 0,
    departureAt: '2026-09-12T16:20:00+09:00',
    arrivalAt: '2026-09-12T18:00:00+09:00',
    source: 'OSRM',
    dataQuality: 'live',
  };
  const t1 = transit('t1', '9000성남 → 144', 34);
  const t2 = transit('t2', '9000성남 → 144', 34);
  const out = dedupeTransitOptions([walk, car, t1, t2]);
  expect(out.map((r) => r.id)).toEqual(['walk-1', 'car-1', 't1']);
});

test('fallback splits the label when no segments exist', () => {
  const a: RouteOption = { ...transit('a', '9000성남 → 144', 34), segments: undefined };
  const b: RouteOption = { ...transit('b', '9000성남 → 144', 34), segments: undefined };
  const out = dedupeTransitOptions([a, b]);
  expect(out.map((r) => r.id)).toEqual(['a']);
});