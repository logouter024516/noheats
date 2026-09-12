/**
 * Pure 서울시 대중교통환승경로 (ws.bus.go.kr pathinfo) normalization.
 *
 * The service returns XML like:
 *   <ServiceResult><msgHeader>…</msgHeader><msgBody>
 *     <itemList>                       ← one per route alternative (0..4)
 *       <pathList>…</pathList>
 *       <pathInfoList>
 *         <pathInfo>
 *           <routeId>…</routeId><routeNm>4호선</routeNm>
 *           <fid>…</fid><fname>혜화</fname><fx>127.…</fx><fy>37.…</fy>
 *           <tid>…</tid><tname>동대문역사문화공원</tname><tx>…</tx><ty>…</ty>
 *         </pathInfo>                  ← one leg per vehicle ride
 *         …
 *       </pathInfoList>
 *       <time>…</time><distance>…</distance>
 *     </itemList>
 *   </msgBody></ServiceResult>
 *
 * Known provider limits (documented, never papered over):
 *  - No walking legs → access/transfer/egress walking is ESTIMATED from
 *    haversine gaps × a documented detour factor.
 *  - No per-leg times → the provider total is split across legs proportional
 *    to each leg's natural time (walk 78 m/min, transit ~8 m/s) and scaled to
 *    match. Waiting is not exposed → waitMin = 0 and waiting is absorbed into
 *    the vehicle share.
 * The returned shape matches normalize-odsay.mjs so the client treats both
 * transit providers identically.
 */

const WALK_SPEED_MPS = 1.3; // 78 m/min, conservative
const WALK_DETOUR = 1.3; // crow-fly → street distance factor
const TRANSIT_SPEED_MPS = 8; // ~29 km/h average across bus/subway legs

function toKstIso(ms) {
  return new Date(ms + 9 * 3600_000).toISOString().replace(/\.\d{3}Z$/, '+09:00');
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Natural (per-mode-speed) minutes for a straight segment. */
function naturalMin(meters, mode) {
  const speed = mode === 'walk' ? WALK_SPEED_MPS : TRANSIT_SPEED_MPS;
  return meters / (speed * 60);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function legLabel(routeNm) {
  const name = String(routeNm ?? '').trim();
  if (!name) return '대중교통';
  if (/호선|공항철도|경부선|ITX|누리로/.test(name)) return `지하철 ${name}`;
  return `버스 ${name}`;
}

const SUBWAY_RE = /호선|공항철도|ITX|경부선/;

function legMode(routeNm) {
  return SUBWAY_RE.test(String(routeNm ?? '')) ? 'subway' : 'bus';
}

function legPoint(leg, prefix) {
  const x = num(leg[`${prefix}x`]);
  const y = num(leg[`${prefix}y`]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const name = String(leg[`${prefix}name`] ?? '').trim() || undefined;
  return { latitude: y, longitude: x, name };
}

/** Normalize one msgBody.itemList into a RouteOption-like (or null when empty). */
function normalizeItem(item, arrivalTime, origin, destination, idx) {
  // Live bus.go.kr pathinfo emits repeated <pathList> legs and <time> in MINUTES.
  const pl = item?.pathList ?? item?.pathInfoList;
  const raw = Array.isArray(pl) ? pl : pl?.pathInfo ?? [];
  const legs = Array.isArray(raw) ? raw : [raw];
  const sourceMin = num(item?.time);
  if (!(sourceMin > 0) || legs.length === 0) return null;
  const totalMin = Math.max(1, Math.round(sourceMin));

  const geometry = [{ ...origin }];
  const rawSegments = [];
  let cursor = origin;
  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i] ?? {};
    const from = legPoint(leg, 'f');
    const to = legPoint(leg, 't');

    if (from && cursor) {
      const meters =
        haversineMeters(cursor.latitude, cursor.longitude, from.latitude, from.longitude) * WALK_DETOUR;
      if (meters > 20) {
        rawSegments.push({ mode: 'walk', label: i === 0 ? '도보 (출발)' : '도보 (환승)', meters, startName: i === 0 ? '출발지' : cursor.name, endName: from.name });
        geometry.push({ ...from });
      }
    }

    if (from && to) {
      rawSegments.push({
        mode: legMode(leg.routeNm),
        label: legLabel(leg.routeNm),
        meters: haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude),
        startName: from.name,
        endName: to.name,
      });
      geometry.push({ ...to });
      cursor = { ...to };
    }
  }
  if (rawSegments.length === 0) return null;

  const egressMeters =
    haversineMeters(cursor.latitude, cursor.longitude, destination.latitude, destination.longitude) *
    WALK_DETOUR;
  if (egressMeters > 20) {
    rawSegments.push({ mode: 'walk', label: '도보 (도착)', meters: egressMeters, startName: cursor.name, endName: '도착지' });
  }
  if (geometry[geometry.length - 1].longitude !== destination.longitude) {
    geometry.push({ ...destination });
  }

  // Allocate the provider total across legs by natural-time share.
  const natural = rawSegments.map((s) => naturalMin(s.meters, s.mode));
  const naturalSum = natural.reduce((a, b) => a + b, 0);
  const scale = naturalSum > 0 ? Math.min(3, Math.max(0.5, totalMin / naturalSum)) : 1;

  const segments = rawSegments.map((s, i) => {
    const durationMin = Math.max(0, Math.round(natural[i] * scale));
    return {
      mode: s.mode,
      label: s.label,
      durationMin,
      outdoor: s.mode === 'walk',
      startName: s.startName,
      endName: s.endName,
      distance: Math.round(s.meters),
    };
  });
  // Rebalance rounding drift back into the final vehicle leg.
  const spent = segments.reduce((a, s) => a + s.durationMin, 0);
  let drift = totalMin - spent;
  for (let i = segments.length - 1; i >= 0 && drift !== 0; i -= 1) {
    if (segments[i].mode !== 'walk') {
      segments[i].durationMin = Math.max(0, segments[i].durationMin + drift);
      drift = 0;
    }
  }

  const walkMin = Math.round(segments.filter((s) => s.mode === 'walk').reduce((a, s) => a + s.durationMin, 0));
  const transfers = Math.max(0, legs.length - 1);
  const label =
    legs
      .map((l) => legLabel(l.routeNm))
      .slice(0, 2)
      .join(' → ') || '대중교통';

  const departure = toKstIso(new Date(arrivalTime).getTime() - totalMin * 60_000);

  return {
    id: `transit-seoul-${idx}`,
    mode: 'transit',
    label,
    durationMin: totalMin,
    walkMin,
    waitMin: 0,
    transfers,
    geometry,
    segments: segments.map(({ mode, label: segLabel, durationMin, outdoor, startName, endName, distance }) => ({
      mode,
      label: segLabel,
      durationMin,
      outdoor,
      startName,
      endName,
      distance,
    })),
    departureAt: departure,
    arrivalAt: arrivalTime,
    source: '서울시 대중교통실시간',
    dataQuality: 'live',
  };
}

/** Normalize a parsed bus.go.kr pathinfo payload into RouteOption-likes. */
export function normalizeSeoul(data, arrivalTime, originLat, originLon, destLat, destLon) {
  const itemList =
    data?.ServiceResult?.msgBody?.itemList ?? data?.msgBody?.itemList ?? data?.itemList;
  const items = Array.isArray(itemList) ? itemList : itemList && typeof itemList === 'object' ? [itemList] : [];
  if (items.length === 0) return [];

  const origin = { latitude: num(originLat), longitude: num(originLon) };
  const destination = { latitude: num(destLat), longitude: num(destLon) };
  if (!Number.isFinite(origin.latitude) || !Number.isFinite(destination.latitude)) return [];

  return items
    .map((item, i) => normalizeItem(item, arrivalTime, origin, destination, i))
    .filter(Boolean)
    .slice(0, 4);
}