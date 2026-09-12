import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOdsay, segmentMode, segmentLabel } from '../normalize-odsay.mjs';
import { ODsaySubwaySample } from './odsay-sample.mjs';

const ARRIVAL = '2026-09-12T09:00:00+09:00';

test('normalizes a subway path with walk access/egress', () => {
  const routes = normalizeOdsay(ODsaySubwaySample, ARRIVAL);
  assert.equal(routes.length, 2);

  const metro = routes[0];
  assert.equal(metro.durationMin, 22); // 1300s / 60
  assert.equal(metro.walkMin, 10); // 300s + 300s walk
  assert.equal(metro.transfers, 0); // single vehicle run
  assert.ok(metro.waitMin >= 1, `waitMin should be at least 1, got ${metro.waitMin}`);
  assert.equal(metro.label, '2호선');
  assert.equal(metro.source, 'ODsay');
  assert.equal(metro.dataQuality, 'live');

  const segs = metro.segments;
  assert.equal(segs.length, 3);
  assert.equal(segs[0].mode, 'walk');
  assert.equal(segs[0].outdoor, true);
  assert.equal(segs[1].mode, 'subway');
  assert.equal(segs[1].outdoor, false);
  assert.equal(segs[1].label, '2호선');
  assert.equal(segs[1].durationMin, 12);
  // arrivalTime preserved, departure = arrival - duration
  assert.equal(metro.arrivalAt, ARRIVAL);
});

test('counts a bus-bus transfer walk as exposed transfer segment', () => {
  const routes = normalizeOdsay(ODsaySubwaySample, ARRIVAL);
  const bus = routes[1];

  // walk(4min) + bus(15) + transfer-walk(3) + bus(10) + walk(2) = 34min parts;
  // totalTime 1780s = 30min → wait derived ≈ min 1 with the documented heuristic
  assert.equal(bus.transfers, 1); // two vehicle runs
  assert.equal(bus.segments.filter((s) => s.outdoor).reduce((a, s) => a + s.durationMin, 0), 9);

  const transfer = bus.segments.find((s) => s.label === '도보');
  // trafficType 3 (transfer) is classified as walk => outdoor exposure applies
  assert.ok(transfer);
  assert.equal(transfer.outdoor, true);
});

test('is mode/label mapping stable', () => {
  assert.equal(segmentMode(1), 'subway');
  assert.equal(segmentMode(2), 'bus');
  assert.equal(segmentMode(6), 'train');
  assert.equal(segmentMode(3), 'walk');
  assert.equal(segmentMode(4), 'walk');
  assert.equal(segmentLabel({ trafficType: 4 }), '도보');
  assert.equal(segmentLabel({ trafficType: 1, lane: [{ name: '2호선' }] }), '2호선');
});

test('handles empty/garbage payloads', () => {
  assert.deepEqual(normalizeOdsay({}, ARRIVAL), []);
  assert.deepEqual(normalizeOdsay(null, ARRIVAL), []);
  assert.deepEqual(normalizeOdsay({ result: { path: 'oops' } }, ARRIVAL), []);
});