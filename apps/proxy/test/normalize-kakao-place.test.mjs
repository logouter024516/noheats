import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeKakaoPlace,
  normalizeKakaoAddress,
  normalizeKakaoReverse,
  dedupePlacesByCoord,
  isInKorea,
} from '../normalize-kakao-place.mjs';

test('normalizes a Kakao subway-station document', () => {
  const p = normalizeKakaoPlace({
    place_name: '강남역',
    road_address_name: '서울 강남구 강남대로 396',
    address_name: '서울 강남구 역삼동 737',
    x: '127.0276',
    y: '37.4979',
  });
  assert.equal(p.label, '강남역');
  assert.equal(p.subLabel, '서울 강남구 강남대로 396');
  assert.equal(p.coordinate.latitude, 37.4979);
  assert.equal(p.coordinate.longitude, 127.0276);
  assert.equal(p.source, 'kakao');
});

test('falls back to address_name when road address is empty', () => {
  const p = normalizeKakaoPlace({
    place_name: '부산역',
    road_address_name: '',
    address_name: '부산 동구 중앙대로 206',
    x: '129.0409',
    y: '35.1152',
  });
  assert.equal(p.subLabel, '부산 동구 중앙대로 206');
});

test('rejects documents outside Korea or without coordinates', () => {
  assert.equal(normalizeKakaoPlace({ place_name: 'x', x: '2', y: '48' }), null);
  assert.equal(normalizeKakaoPlace({ place_name: 'x' }), null);
  assert.equal(normalizeKakaoPlace(null), null);
  assert.equal(normalizeKakaoPlace({ place_name: '', x: '127', y: '37' }), null);
});

test('isInKorea boundary checks', () => {
  assert.equal(isInKorea(37.5665, 126.978), true);
  assert.equal(isInKorea(10, 126), false);
  assert.equal(isInKorea('37', '127'), false);
  assert.equal(isInKorea(Number.NaN, 126), false);
});

test('normalizes an address-search document with road address', () => {
  const p = normalizeKakaoAddress({
    address_name: '서울 강남구 역삼동 737',
    road_address: {
      address_name: '강남대로 396',
      region_1depth_name: '서울',
      region_2depth_name: '강남구',
    },
    x: '127.0276',
    y: '37.4979',
  });
  assert.equal(p.label, '서울 강남구 강남대로 396');
  assert.equal(p.subLabel, '서울 강남구 역삼동 737');
  assert.equal(p.source, 'kakao-address');
  assert.equal(p.coordinate.latitude, 37.4979);
});

test('normalizes an address-search document without road address', () => {
  const p = normalizeKakaoAddress({
    address_name: '경기 성남시 분당구 정자동 1',
    road_address: null,
    x: '127.1052',
    y: '37.3602',
  });
  assert.equal(p.label, '경기 성남시 분당구 정자동 1');
  assert.equal(p.subLabel, undefined);
});

test('normalizes a reverse-geocode document preferring road address', () => {
  const p = normalizeKakaoReverse(
    {
      road_address: {
        address_name: '강남대로 396',
        region_1depth_name: '서울',
        region_2depth_name: '강남구',
      },
      address: {
        address_name: '서울 강남구 역삼동 737',
        region_3depth_name: '역삼동',
      },
    },
    37.4979,
    127.0276,
  );
  assert.equal(p.label, '서울 강남구 강남대로 396');
  assert.equal(p.subLabel, '서울 강남구 역삼동 737');
  assert.equal(p.source, 'kakao');
});

test('reverse falls back to admin address when no road address', () => {
  const p = normalizeKakaoReverse(
    {
      road_address: null,
      address: { address_name: '부산 부산진구 부전동 573-1', region_3depth_name: '부전동' },
    },
    35.1537,
    129.0591,
  );
  assert.equal(p.label, '부산 부산진구 부전동 573-1');
  assert.equal(p.subLabel, '부전동');
});

test('reverse rejects unusable documents', () => {
  assert.equal(normalizeKakaoReverse({ road_address: null, address: null }, 37, 127), null);
  assert.equal(normalizeKakaoReverse({ address: { address_name: 'x' } }, 10, 126), null);
});

test('dedupePlacesByCoord keeps first occurrence per rounded coordinate', () => {
  const a = normalizeKakaoPlace({
    place_name: '강남역',
    road_address_name: '서울 강남구 강남대로 396',
    x: '127.0276',
    y: '37.4979',
  });
  const b = normalizeKakaoAddress({
    address_name: '서울 강남구 역삼동 737',
    road_address: { address_name: '강남대로 396' },
    x: '127.02762',
    y: '37.49792',
  });
  const c = normalizeKakaoPlace({
    place_name: '선릉역',
    road_address_name: '서울 강남구 선릉로 511',
    x: '127.0490',
    y: '37.5045',
  });
  const out = dedupePlacesByCoord([a, b, c]);
  assert.equal(out.length, 2);
  assert.equal(out[0].label, '강남역');
  assert.equal(out[1].label, '선릉역');
});