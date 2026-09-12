import { RouteOption, Place, RouteSegment } from '../domain/types';
import { TransitProvider } from '../providers/types';
import { apiUrl } from '../utils/apiUrl';

const PROXY_URL = apiUrl('/api/transit');

/** Normalize a proxy-delivered route into a domain RouteOption with segments. */
function toSegment(raw: any): RouteSegment {
  const mode = raw.mode === 'walk' ? 'walk' : raw.mode === 'bus' ? 'bus' : raw.mode === 'train' ? 'train' : raw.mode === 'car' ? 'car' : 'subway';
  return {
    mode,
    label: raw.label ?? (mode === 'walk' ? '도보' : mode === 'car' ? '자동차' : '대중교통'),
    durationMin: Math.round(raw.sectionTime ? raw.sectionTime / 60 : raw.durationMin ?? 0),
    outdoor: mode === 'walk',
    startName: raw.startName,
    endName: raw.endName,
  };
}

function normalizeProxyRoute(r: any, i: number, arrivalTime: string, source: string): RouteOption {
  const segments: RouteSegment[] | undefined = Array.isArray(r.segments)
    ? r.segments.map(toSegment)
    : undefined;
  const walkMinFromSegments = segments
    ? segments.filter((s: RouteSegment) => s.mode === 'walk').reduce((a: number, s: RouteSegment) => a + s.durationMin, 0)
    : 0;
  return {
    id: r.id ?? `transit-${Date.now()}-${i}`,
    mode: r.mode === 'car' ? 'car' : 'transit',
    label: r.label ?? '대중교통',
    durationMin: Math.round(r.durationMin),
    walkMin: Math.round(r.walkMin ?? walkMinFromSegments),
    waitMin: Math.round(r.waitMin ?? 5),
    transfers: r.transfers ?? 0,
    geometry: r.geometry,
    departureAt: r.departureAt,
    arrivalAt: arrivalTime,
    source,
    dataQuality: r.dataQuality === 'demo' ? 'demo' : 'live',
    segments,
  };
}

export async function fetchTransitRoutes(
  origin: Place,
  destination: Place,
  arrivalTime: string,
): Promise<RouteOption[]> {
  let res: Response;
  try {
    res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originLat: origin.coordinate.latitude,
        originLon: origin.coordinate.longitude,
        destLat: destination.coordinate.latitude,
        destLon: destination.coordinate.longitude,
        arrivalTime,
      }),
    });
  } catch {
    throw new Error('대중교통 서버에 연결할 수 없습니다.');
  }

  if (!res.ok) {
    let reason = '대중교통 서버가 응답하지 않았습니다.';
    try {
      const body = await res.json();
      if (body?.error && /key|api|설정|사용불가|not configured/i.test(String(body.error))) {
        reason = '대중교통 실시간 API 키가 설정되지 않았습니다. 서버에 키를 넣으면 실시간 경로가 뜹니다.';
      } else if (typeof body?.error === 'string') {
        reason = `대중교통 서버 오류: ${body.error}`;
      }
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(reason);
  }

  const data = await res.json();
  if (!data.routes || !Array.isArray(data.routes)) return [];

  return data.routes.map((r: any, i: number) =>
    normalizeProxyRoute(r, i, arrivalTime, r.source ?? '대중교통 실시간'),
  );
}

export const transitProvider: TransitProvider = {
  name: 'proxy transit (ODsay/서울시)',
  fetch: fetchTransitRoutes,
};