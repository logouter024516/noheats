import { RouteOption, Place, RouteSegment } from '../domain/types';
import { TransitProvider } from '../providers/types';
import { apiUrl } from '../utils/apiUrl';

/**
 * 서울특별시 "대중교통환승경로 조회 서비스" (api.bus.go.kr/api/rest/pathinfo) 프록시 엔드포인트.
 * 서버(PROXY_URL)가 getPathInfoBySubwayList / getPathInfoByBusList / getPathInfoByBusNSubList
 * 를 호출해 하나의 RouteOption[] 형태로 정규화해서 내려준다.
 * 원본 API는 매일 새벽 5시에 데이터가 갱신된다 (가이드 "데이터 갱신주기" 참고).
 */
const PROXY_URL = apiUrl('/api/transit');

/**
 * 대중교통환승경로 조회 서비스 공식 오류코드(headerCd) 매핑.
 * 가이드 "오류코드 안내" 표 그대로 옮긴 값.
 */
const TRANSIT_ERROR_MESSAGES: Record<string, string> = {
  '1': '대중교통 API에서 시스템 오류가 발생했습니다.',
  '2': '잘못된 쿼리 요청입니다. 좌표/검색어 등 요청 변수를 확인해 주세요.',
  '3': '정류소를 찾을 수 없습니다.',
  '4': '노선을 찾을 수 없습니다.',
  '5': '잘못된 위치로 요청했습니다. 위/경도 좌표를 확인해 주세요.',
  '6': '실시간 정보를 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.',
  '7': '경로 검색 결과가 존재하지 않습니다.',
  '8': '해당 노선이 운행 종료되었습니다.',
};

/** Normalize a proxy-delivered route into a domain RouteOption with segments. */
function toSegment(raw: any): RouteSegment {
  const mode = raw.mode === 'walk' ? 'walk' : raw.mode === 'bus' ? 'bus' : raw.mode === 'train' ? 'train' : raw.mode === 'car' ? 'car' : 'subway';
  return {
    mode,
    // 가이드 상 지하철=routeNm(호선명), 버스=routeNm(노선명) 필드를 label로 매핑
    label: raw.label ?? raw.routeNm ?? (mode === 'walk' ? '도보' : mode === 'car' ? '자동차' : '대중교통'),
    durationMin: Math.round(raw.sectionTime ? raw.sectionTime / 60 : raw.durationMin ?? 0),
    outdoor: mode === 'walk',
    startName: raw.startName ?? raw.fname,
    endName: raw.endName ?? raw.tname,
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
    durationMin: Math.round(r.durationMin ?? r.time ?? 0), // 가이드의 응답 필드 "time"(소요시간) 폴백
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
      // 프록시가 원본 API의 headerCd/headerMsg를 그대로 전달하는 경우, 공식 오류코드 표를 우선 사용
      const headerCd = body?.headerCd != null ? String(body.headerCd) : undefined;
      if (headerCd && TRANSIT_ERROR_MESSAGES[headerCd]) {
        reason = `대중교통 서버 오류(${headerCd}): ${TRANSIT_ERROR_MESSAGES[headerCd]}`;
      } else if (body?.error && /key|api|설정|사용불가|not configured/i.test(String(body.error))) {
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
    normalizeProxyRoute(r, i, arrivalTime, r.source ?? '서울시 대중교통환승경로 조회 서비스'),
  );
}

export const transitProvider: TransitProvider = {
  name: '서울시 대중교통환승경로 조회 서비스 (api.bus.go.kr) proxy',
  fetch: fetchTransitRoutes,
};