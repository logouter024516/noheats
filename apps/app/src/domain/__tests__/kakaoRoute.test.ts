import { Place } from '../types';
import { buildKakaoRouteQuery } from '../../adapters/kakaoRoute';

function place(label: string, lat: number, lon: number): Place {
  return {
    label,
    coordinate: { latitude: lat, longitude: lon },
    source: 'test',
  };
}

test('builds WGS84 query with sName/eName and plain coords', () => {
  const q = buildKakaoRouteQuery(place('을지로입구역 2호선', 37.5659, 126.9827), place('강남역 2호선', 37.499, 127.028));
  expect(q).toContain('sx=126.9827');
  expect(q).toContain('sy=37.5659');
  expect(q).toContain('ex=127.028');
  expect(q).toContain('ey=37.499');
  expect(decodeURIComponent(q)).toContain('sName=을지로입구역 2호선');
  expect(decodeURIComponent(q)).toContain('eName=강남역 2호선');
});

test('percent-encodes Korean labels', () => {
  const q = buildKakaoRouteQuery(place('서울역', 37.5547, 126.9707), place('판교역', 37.3947, 127.1111));
  expect(q).not.toContain('서울');
  expect(decodeURIComponent(q)).toContain('서울역');
});