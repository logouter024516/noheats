import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKakaoNavi } from '../normalize-kakao-navi.mjs';

const ARRIVAL = '2026-09-10T18:00:00+09:00';

const SAMPLE = {
  routes: [
    {
      summary: {
        distance: 8900,
        duration: 2040,
        tollFare: 0,
        taxiFare: 21000,
      },
      sections: [
        {
          roads: [
            { name: '강남대로', distance: 4500, duration: 900, vertexes: [127.0276, 37.498, 127.02, 37.507, 127.0147, 37.5675] },
            { name: '율곡로', distance: 4400, duration: 1140, vertexes: [127.0147, 37.5675, 127.02, 37.568, 127.0276, 37.57] },
          ],
          guides: [],
        },
      ],
    },
  ],
};

test('maps summary duration/distance and stamps car route', () => {
  const routes = normalizeKakaoNavi(SAMPLE, ARRIVAL);
  assert.equal(routes.length, 1);
  const r = routes[0];
  assert.equal(r.mode, 'car');
  assert.equal(r.label, '자동차');
  assert.equal(r.durationMin, 34); // 2040s
  assert.equal(r.walkMin, 0);
  assert.equal(r.waitMin, 0);
  assert.equal(r.transfers, 0);
  assert.equal(r.source, 'Kakao Navi');
  assert.equal(r.dataQuality, 'live');
  assert.equal(r.departureAt, '2026-09-10T17:26:00+09:00');
  assert.equal(r.arrivalAt, ARRIVAL);
  assert.equal(r.segments[0].mode, 'car');
  assert.equal(r.segments[0].outdoor, false);
});

test('flattens road vertexes into a lon/lat polyline', () => {
  const routes = normalizeKakaoNavi(SAMPLE, ARRIVAL);
  const g = routes[0].geometry;
  assert.ok(g.length >= 3);
  assert.deepEqual(g[0], { latitude: 37.498, longitude: 127.0276 });
  assert.deepEqual(g[g.length - 1], { latitude: 37.57, longitude: 127.0276 });
});

test('missing sections still yields a route without geometry', () => {
  const noGeo = { routes: [{ summary: { duration: 1500, distance: 6000 } }] };
  const routes = normalizeKakaoNavi(noGeo, ARRIVAL);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].durationMin, 25);
  assert.equal(routes[0].geometry, undefined);
});

test('empty / invalid payloads yield no routes', () => {
  assert.deepEqual(normalizeKakaoNavi({}, ARRIVAL), []);
  assert.deepEqual(normalizeKakaoNavi({ routes: [] }, ARRIVAL), []);
  assert.deepEqual(normalizeKakaoNavi({ routes: [{ summary: { duration: 0 } }] }, ARRIVAL), []);
});