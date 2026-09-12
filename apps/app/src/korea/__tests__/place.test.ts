import {
  isInKorea,
  stripGlobalComponents,
  buildAdminLabel,
  normalizeNominatimPlace,
  normalizeNominatimReverse,
  dedupePlaces,
} from '../place';
import { Place } from '../../domain/types';

function rawNominatim(overrides: Record<string, unknown> = {}) {
  return {
    lat: '37.5663',
    lon: '126.9829',
    type: 'subway',
    name: '을지로입구역',
    display_name: '을지로입구역, 을지로, 을지로입구, 서울특별시, 대한민국',
    address: {
      railway: '을지로입구역',
      city_district: '중구',
      state: '서울특별시',
      country: '대한민국',
    },
    extratags: { railway: 'station', station: 'subway' },
    ...overrides,
  };
}

describe('korea/place — Korea-first normalization', () => {
  it('classifies Korea bounds', () => {
    expect(isInKorea(37.5663, 126.9829)).toBe(true);
    expect(isInKorea(35.1796, 129.0756)).toBe(true); // Busan
    expect(isInKorea(48.8566, 2.3522)).toBe(false); // Paris
  });

  it('strips global address components', () => {
    expect(stripGlobalComponents('서울역, 서울특별시, 대한민국')).toBe('서울역, 서울특별시');
    expect(stripGlobalComponents('Gangnam Station, Seoul, South Korea')).toBe('Gangnam Station, Seoul');
  });

  it('builds Korean admin labels for special cities and provinces', () => {
    expect(buildAdminLabel({ state: '서울특별시', city_district: '강남구' })).toBe('서울특별시 강남구');
    expect(buildAdminLabel({ state: '경기도', city: '고양시' })).toBe('경기도 고양시');
    expect(buildAdminLabel({ state: '제주특별자치도' })).toBe('제주특별자치도');
    expect(buildAdminLabel({})).toBeUndefined();
  });

  it('normalizes a subway station to Korean label + subLabel', () => {
    const p = normalizeNominatimPlace(rawNominatim());
    expect(p).not.toBeNull();
    expect(p!.label).toBe('을지로입구역');
    expect(p!.subLabel).toBe('서울특별시 중구');
    expect(p!.coordinate.latitude).toBe(37.5663);
    expect(p!.source).toBe('nominatim');
  });

  it('uses city+district subLabel for a Gangnam-type result', () => {
    const p = normalizeNominatimPlace(
      rawNominatim({
        name: '강남역',
        lat: '37.498',
        lon: '127.0276',
        address: { subway: '강남역', city_district: '강남구', state: '서울특별시', country: '대한민국' },
      }),
    );
    expect(p!.label).toBe('강남역');
    expect(p!.subLabel).toBe('서울특별시 강남구');
  });

  it('rejects non-Korean and unusable results', () => {
    expect(
      normalizeNominatimPlace(
        rawNominatim({ lat: '48.8566', lon: '2.3522', address: { state: 'Île-de-France', country: 'France' } }),
      ),
    ).toBeNull();
    expect(normalizeNominatimPlace({})).toBeNull();
    expect(normalizeNominatimPlace(rawNominatim({ lat: 'abc', lon: 'xyz' }))).toBeNull();
  });

  it('dedupes identical place results', () => {
    const a: Place = { label: '서울역', subLabel: '서울특별시 용산구', coordinate: { latitude: 37.55, longitude: 126.97 } };
    const b: Place = { label: '서울역', subLabel: '서울특별시 용산구', coordinate: { latitude: 37.55, longitude: 126.97 } };
    const c: Place = { label: '서울역', subLabel: '서울특별시 중구', coordinate: { latitude: 37.55, longitude: 126.97 } };
    expect(dedupePlaces([a, b, c]).length).toBe(2);
  });

  it('normalizes a Nominatim reverse result to a short Korean label', () => {
    const p = normalizeNominatimReverse({
      lat: '37.5663',
      lon: '126.9829',
      display_name: '을지로입구역, 을지로, 을지로입구, 서울특별시, 대한민국',
      address: {
        railway: '을지로입구역',
        city_district: '중구',
        state: '서울특별시',
        country: '대한민국',
      },
    });
    expect(p).not.toBeNull();
    expect(p!.label).toBe('을지로입구역');
    expect(p!.subLabel).toBe('서울특별시 중구');
    expect(p!.source).toBe('nominatim');
  });

  it('falls back to the road name when reverse has no POI', () => {
    const p = normalizeNominatimReverse({
      lat: '37.5663',
      lon: '126.9779',
      display_name: '월계로, 중구, 서울특별시, 대한민국',
      address: {
        road: '월계로',
        city_district: '중구',
        state: '서울특별시',
        country: '대한민국',
      },
    });
    expect(p!.label).toBe('월계로');
    expect(p!.subLabel).toBe('서울특별시 중구');
  });

  it('rejects a reverse result outside Korea', () => {
    expect(
      normalizeNominatimReverse({
        lat: '48.8566',
        lon: '2.3522',
        display_name: 'Paris, France',
        address: { state: 'Île-de-France', country: 'France' },
      }),
    ).toBeNull();
  });
});