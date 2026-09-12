/**
 * Normalize one Kakao Local API document (v2/local/search/keyword.json) into the
 * HeatPizza `Place` domain shape the client expects:
 *   { label, subLabel, coordinate: { latitude, longitude }, source }
 * Pure and unit-testable; no network I/O.
 */

const KOREA_BBOX = {
  minLat: 33.05,
  maxLat: 38.7,
  minLon: 124.5,
  maxLon: 131.95,
};

export function isInKorea(lat, lon) {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= KOREA_BBOX.minLat &&
    lat <= KOREA_BBOX.maxLat &&
    lon >= KOREA_BBOX.minLon &&
    lon <= KOREA_BBOX.maxLon
  );
}

/** Normalize a single Kakao search.json document. Returns null when unusable. */
export function normalizeKakaoPlace(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const lat = Number(doc.y);
  const lon = Number(doc.x);
  if (!isInKorea(lat, lon)) return null;
  const label = String(doc.place_name ?? '').trim();
  if (!label) return null;
  const road = String(doc.road_address_name ?? '').trim();
  const addr = String(doc.address_name ?? '').trim();
  const subLabel = road || addr || undefined;
  return { label, subLabel, coordinate: { latitude: lat, longitude: lon }, source: 'kakao' };
}

function depthName(obj, depth) {
  const v = obj?.[depth];
  return typeof v === 'string' ? v : '';
}

function fillRoadFull(doc) {
  const road = doc?.road_address;
  if (!road || typeof road !== 'object') return '';
  return [depthName(road, 'region_1depth_name'), depthName(road, 'region_2depth_name'), String(road.address_name ?? '').trim()]
    .filter(Boolean)
    .join(' ');
}

/**
 * Normalize one Kakao address-search document (v2/local/search/address.json)
 * into the Place shape. Address docs have `address`, `road_address`, `x`, `y`
 * at the top level but no `place_name`, so the short road address becomes the
 * label. Returns null when unusable.
 */
export function normalizeKakaoAddress(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const lat = Number(doc.y);
  const lon = Number(doc.x);
  if (!isInKorea(lat, lon)) return null;
  const roadFull = fillRoadFull(doc);
  const addr = String(doc.address_name ?? '').trim();
  const label = roadFull || addr;
  if (!label) return null;
  const subLabel = roadFull && roadFull !== addr ? addr : undefined;
  return { label, subLabel, coordinate: { latitude: lat, longitude: lon }, source: 'kakao-address' };
}

/**
 * Normalize one Kakao coord2address document (v2/local/geo/coord2address.json)
 * into the Place shape. Prefers the road address; falls back to the concise
 * administrative address. Returns null when unusable.
 */
export function normalizeKakaoReverse(doc, lat, lon) {
  if (!doc || typeof doc !== 'object') return null;
  if (!isInKorea(lat, lon)) return null;
  const roadFull = fillRoadFull(doc);
  const addr = String(doc?.address?.address_name ?? '').trim();
  const regionDepth3 = depthName(doc?.address, 'region_3depth_name');
  const label = roadFull || addr;
  if (!label) return null;
  const subLabel = roadFull ? (addr || regionDepth3) : regionDepth3;
  return { label, subLabel: subLabel || undefined, coordinate: { latitude: lat, longitude: lon }, source: 'kakao' };
}

/** Remove duplicates that share the same rounded coordinate (keyword vs address). */
export function dedupePlacesByCoord(places, precision = 4) {
  const seen = new Set();
  const out = [];
  for (const p of places) {
    if (!p) continue;
    const key = `${p.coordinate.latitude.toFixed(precision)},${p.coordinate.longitude.toFixed(precision)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}