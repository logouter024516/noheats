import { Place } from '../domain/types';
import { apiUrl } from '../utils/apiUrl';

const PROXY_URL = apiUrl('/api/kakao-route');

/** 카카오맵 웹 길찾기 링크를 여는 데 쓰는 query string (WGS84 → WCONGNAMUL은 프록시가 변환). */
export function buildKakaoRouteQuery(from: Place, to: Place): string {
  const params = new URLSearchParams({
    sx: String(from.coordinate.longitude),
    sy: String(from.coordinate.latitude),
    sName: from.label,
    ex: String(to.coordinate.longitude),
    ey: String(to.coordinate.latitude),
    eName: to.label,
  });
  return params.toString().replace(/\+/g, '%20');
}

export async function fetchKakaoRouteLink(from: Place, to: Place): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${PROXY_URL}?${buildKakaoRouteQuery(from, to)}`);
  } catch {
    throw new Error('길찾기 서버에 연결할 수 없습니다.');
  }

  if (!res.ok) {
    let reason = '길찾기 링크를 만들지 못했습니다.';
    try {
      const body = await res.json();
      if (typeof body?.error === 'string') reason = body.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(reason);
  }

  const data = await res.json();
  if (!data.landingUrl) throw new Error('길찾기 링크가 비어 있습니다.');
  return data.landingUrl as string;
}