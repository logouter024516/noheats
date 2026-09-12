/**
 * Pure Kakao Mobility 자동차 길찾기 (v1/directions) normalization.
 *
 * Kakao Navi returns routes[]; we take the first RECOMMEND route. Fields used:
 *   route.summary.duration  (seconds)
 *   route.summary.distance  (meters)
 *   route.sections[].roads[].vertexes  (flat [lon,lat,lon,lat,…] polyline)
 * `summary=false` is requested so road geometry is present; if the payload is
 * missing roads for any reason, the route still carries duration/distance but
 * no polyline (the map simply draws nothing for it — no fabrication).
 */

function toKstIso(ms) {
  return new Date(ms + 9 * 3600_000).toISOString().replace(/\.\d{3}Z$/, '+09:00');
}

function geometryFromSections(sections) {
  if (!Array.isArray(sections)) return undefined;
  const pairs = [];
  for (const section of sections) {
    const roads = Array.isArray(section?.roads) ? section.roads : [];
    for (const road of roads) {
      const vx = Array.isArray(road?.vertexes) ? road.vertexes : [];
      for (let i = 0; i + 1 < vx.length; i += 2) {
        const lon = Number(vx[i]);
        const lat = Number(vx[i + 1]);
        if (Number.isFinite(lon) && Number.isFinite(lat)) pairs.push({ latitude: lat, longitude: lon });
      }
    }
  }
  return pairs.length > 0 ? pairs : undefined;
}

/** Normalize a Kakao Navi directions payload into a single car RouteOption-like. */
export function normalizeKakaoNavi(data, arrivalTime) {
  const route = Array.isArray(data?.routes) ? data.routes[0] : null;
  if (!route) return [];
  const summary = route?.summary ?? {};
  const durationSec = Number(summary.duration);
  if (!(durationSec > 0)) return [];

  const durationMin = Math.max(1, Math.round(durationSec / 60));
  const geometry = geometryFromSections(route?.sections);
  const departure = toKstIso(new Date(arrivalTime).getTime() - durationSec * 1000);

  return [
    {
      id: `car-kakao-0`,
      mode: 'car',
      label: '자동차',
      durationMin,
      walkMin: 0,
      waitMin: 0,
      transfers: 0,
      geometry,
      departureAt: departure,
      arrivalAt: arrivalTime,
      source: 'Kakao Navi',
      dataQuality: 'live',
      segments: [
        {
          mode: 'car',
          label: '자동차',
          durationMin,
          outdoor: false,
          startName: '출발지',
          endName: '도착지',
          distance: Number(summary.distance) || undefined,
        },
      ],
    },
  ];
}