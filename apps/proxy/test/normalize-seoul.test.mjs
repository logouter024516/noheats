import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xmlToJson } from '../xml-simple.mjs';
import { normalizeSeoul } from '../normalize-seoul.mjs';

const ARRIVAL = '2026-09-10T18:00:00+09:00';

// Fixture modeled on the documented bus.go.kr pathinfo shape: two route
// alternatives (legacy pathInfoList encoding) plus one live-shape fixture.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<ServiceResult>
  <msgHeader><queryTime>2026-09-10 17:31:00</queryTime><code>0</code><msg>NORMAL_SERVICE</msg></msgHeader>
  <msgBody>
    <itemList>
      <pathInfoList>
        <pathInfo><routeId>A</routeId><routeNm>4호선</routeNm><fid>1</fid><fname>동대문역사문화공원</fname><fx>127.0147</fx><fy>37.5675</fy><tid>2</tid><tname>서울역</tname><tx>126.9707</tx><ty>37.5547</ty></pathInfo>
        <pathInfo><routeId>B</routeId><routeNm>241</routeNm><fid>3</fid><fname>서울역</fname><fx>126.9707</fx><fy>37.5547</fy><tid>4</tid><tname>강남역</tname><tx>127.0276</tx><ty>37.4980</ty></pathInfo>
      </pathInfoList>
      <time>48</time>
      <distance>12300</distance>
    </itemList>
    <itemList>
      <pathInfoList>
        <pathInfo><routeId>C</routeId><routeNm>2호선</routeNm><fid>5</fid><fname>강남역</fname><fx>127.0276</fx><fy>37.4980</fy><tid>6</tid><tname>시청역</tname><tx>126.9750</tx><ty>37.5630</ty></pathInfo>
      </pathInfoList>
      <time>35</time>
      <distance>9800</distance>
    </itemList>
  </msgBody>
</ServiceResult>`;

// Live bus.go.kr shape: repeated <pathList> legs (f/fx/fy → t/tx/ty) and
// <time> carrying MINUTES, exactly as ws.bus.go.kr returns today.
const LIVE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ServiceResult>
  <msgHeader><headerCd>0</headerCd><headerMsg/><itemCount>0</itemCount></msgHeader>
  <msgBody>
    <itemList>
      <distance>6096</distance>
      <pathList><fid>101000148</fid><fname>명동역</fname><fx>126.98246544517124</fx><fy>37.56467328639449</fy><routeId>234000002</routeId><routeNm>9000번남</routeNm><tid>102000070</tid><tname>서초구청</tname><tx>127.00549935448406</tx><ty>37.535740299539675</ty></pathList>
      <pathList><fid>102000071</fid><fname>서초구청</fname><fx>127.00572564263143</fx><fy>37.535442926695985</fy><routeId>100100023</routeId><routeNm>144</routeNm><tid>121000011</tid><tname>지하철2호선강남역</tname><tx>127.02574249481528</tx><ty>37.50173912694457</ty></pathList>
      <time>34</time>
    </itemList>
    <itemList>
      <distance>6788</distance>
      <pathList><fid>101000148</fid><fname>명동역</fname><fx>126.98246544517124</fx><fy>37.56467328639449</fy><routeId>228000447</routeId><routeNm>5005거용버스</routeNm><tid>102000070</tid><tname>서초구청</tname><tx>127.00549935448406</tx><ty>37.535740299539675</ty></pathList>
      <pathList><fid>102000071</fid><fname>서초구청</fname><fx>127.00572564263143</fx><fy>37.535442926695985</fy><routeId>100100068</routeId><routeNm>420</routeNm><tid>121000009</tid><tname>분당선강남역</tname><tx>127.02853390280387</tx><ty>37.49579120702928</ty></pathList>
      <time>35</time>
    </itemList>
  </msgBody>
</ServiceResult>`;

// 출발 동대문역사문화공원(37.5675,127.0147) → 도착 강남역(37.4980,127.0276),
// offset slightly so short access/egress walks are generated like the provider
// (which returns no walking legs at all).
const ORIGIN = { lat: 37.5665, lon: 127.0135 };
const DEST = { lat: 37.499, lon: 127.028 };

test('parses and returns both route alternatives', () => {
  const parsed = xmlToJson(XML);
  const routes = normalizeSeoul(parsed, ARRIVAL, ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon);
  assert.equal(routes.length, 2);
});

test('maps overall duration (minutes) to minutes and labels legs', () => {
  const parsed = xmlToJson(XML);
  const routes = normalizeSeoul(parsed, ARRIVAL, ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon);
  const r0 = routes[0];
  assert.equal(r0.mode, 'transit');
  assert.equal(r0.durationMin, 48); // provider <time> is minutes
  assert.equal(r0.transfers, 1);
  assert.equal(r0.waitMin, 0);
  assert.match(r0.label, /지하철 4호선/);
  assert.match(r0.label, /버스 241/);
  assert.equal(r0.source, '서울시 대중교통실시간');
  assert.equal(r0.dataQuality, 'live');
  assert.equal(r0.departureAt, '2026-09-10T17:12:00+09:00');
  assert.equal(r0.arrivalAt, ARRIVAL);
});

test('parses the live ws.bus.go.kr shape (repeated pathList, minutes)', () => {
  const parsed = xmlToJson(LIVE_XML);
  const routes = normalizeSeoul(parsed, ARRIVAL, ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon);
  assert.equal(routes.length, 2);
  const r0 = routes[0];
  assert.equal(r0.durationMin, 34);
  assert.equal(r0.transfers, 1);
  assert.match(r0.label, /버스 9000번남/);
  assert.match(r0.label, /버스 144/);
  const segs = r0.segments;
  assert.ok(segs.length >= 3);
  assert.ok(segs.some((s) => s.mode === 'bus' && s.label === '버스 144'));
  assert.ok(segs.some((s) => s.mode === 'walk' && s.outdoor === true));
  const subwayish = segs.find((s) => s.label.includes('지하철') || s.label.includes('2호선'));
  assert.equal(subwayish, undefined); // routeNm "144" is a bus line
  const walk = segs.find((s) => s.mode === 'walk');
  assert.equal(walk.startName === '출발지' || walk.startName === '명동역', true);
});

test('segments alternate walk and vehicle and carry station names', () => {
  const parsed = xmlToJson(XML);
  const routes = normalizeSeoul(parsed, ARRIVAL, ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon);
  const segs = routes[0].segments;
  assert.ok(segs.length >= 3);
  assert.ok(segs.some((s) => s.mode === 'walk'));
  assert.ok(segs.some((s) => s.mode === 'subway' && s.label === '지하철 4호선'));
  assert.ok(segs.some((s) => s.mode === 'bus' && s.label === '버스 241'));
  const subway = segs.find((s) => s.mode === 'subway');
  assert.equal(subway.startName, '동대문역사문화공원');
  assert.equal(subway.endName, '서울역');
  assert.ok(subway.outdoor === false);
  const walk = segs.find((s) => s.mode === 'walk');
  assert.equal(walk.outdoor, true);
});

test('walk minutes are a small estimated share of the total', () => {
  const parsed = xmlToJson(XML);
  const routes = normalizeSeoul(parsed, ARRIVAL, ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon);
  const r0 = routes[0];
  assert.ok(r0.walkMin >= 0);
  assert.ok(r0.walkMin < r0.durationMin);
  const segSum = r0.segments.reduce((a, s) => a + s.durationMin, 0);
  assert.equal(segSum, r0.durationMin); // rebalanced to provider total
});

test('geometry spans origin → legs → destination', () => {
  const parsed = xmlToJson(XML);
  const routes = normalizeSeoul(parsed, ARRIVAL, ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon);
  const g = routes[0].geometry;
  assert.ok(g.length >= 2);
  assert.equal(g[0].longitude.toFixed(3), ORIGIN.lon.toFixed(3));
  assert.equal(g[g.length - 1].longitude.toFixed(3), DEST.lon.toFixed(3));
});

test('empty payload yields no routes', () => {
  assert.deepEqual(normalizeSeoul({}, ARRIVAL, ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon), []);
  assert.deepEqual(normalizeSeoul({ ServiceResult: { msgBody: {} } }, ARRIVAL, ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon), []);
});

test('route without numeric time is skipped', () => {
  const xml = `<ServiceResult><msgBody><itemList><pathInfoList><pathInfo><routeNm>2호선</routeNm><fx>127.0</fx><fy>37.5</fy><tx>127.1</tx><ty>37.5</ty></pathInfo></pathInfoList></itemList></msgBody></ServiceResult>`;
  const routes = normalizeSeoul(xmlToJson(xml), ARRIVAL, ORIGIN.lat, ORIGIN.lon, DEST.lat, DEST.lon);
  assert.deepEqual(routes, []);
});