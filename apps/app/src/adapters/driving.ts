import { RouteOption, Place, RouteSegment } from '../domain/types';
import { DrivingRouteProvider } from '../providers/types';
import { apiUrl } from '../utils/apiUrl';

const PROXY_URL = apiUrl('/api/driving');

function normalizeCarRoute(r: any, arrivalTime: string): RouteOption {
  const segments: RouteSegment[] = Array.isArray(r.segments)
    ? r.segments.map((s: any) => ({
        mode: 'car' as const,
        label: s.label ?? '자동차',
        durationMin: Math.round(s.durationMin ?? 0),
        outdoor: false,
        startName: s.startName,
        endName: s.endName,
      }))
    : [];
  return {
    id: r.id ?? `car-${Date.now()}`,
    mode: 'car',
    label: r.label ?? '자동차',
    durationMin: Math.round(r.durationMin),
    walkMin: 0,
    waitMin: 0,
    transfers: 0,
    geometry: r.geometry,
    departureAt: r.departureAt,
    arrivalAt: arrivalTime,
    source: r.source ?? 'Kakao Navi',
    dataQuality: r.dataQuality === 'demo' ? 'demo' : 'live',
    segments,
  };
}

export async function fetchDrivingRoutes(
  origin: Place,
  destination: Place,
  arrivalTime: string,
): Promise<RouteOption[]> {
  const url = new URL(PROXY_URL);
  url.searchParams.set('originLat', String(origin.coordinate.latitude));
  url.searchParams.set('originLon', String(origin.coordinate.longitude));
  url.searchParams.set('destLat', String(destination.coordinate.latitude));
  url.searchParams.set('destLon', String(destination.coordinate.longitude));
  url.searchParams.set('arrivalTime', arrivalTime);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    throw new Error('자동차 경로 서버에 연결할 수 없습니다.');
  }

  if (!res.ok) {
    let reason = '자동차 경로 서버가 응답하지 않았습니다.';
    try {
      const body = await res.json();
      if (body?.error && /key|api|설정|사용불가|not configured|활성화/i.test(String(body.error))) {
        reason = '자동차 길찾기는 아직 준비되지 않았어요 (카카오 길찾기 제품 설정 필요).';
      } else if (typeof body?.error === 'string') {
        reason = `자동차 경로 오류: ${body.error}`;
      }
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(reason);
  }

  const data = await res.json();
  if (!data.routes || !Array.isArray(data.routes)) return [];

  return data.routes.map((r: any) => normalizeCarRoute(r, arrivalTime));
}

export const kakaoNaviDriving: DrivingRouteProvider = {
  name: 'Kakao Navi (via proxy)',
  fetch: fetchDrivingRoutes,
};