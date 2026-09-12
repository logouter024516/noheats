import { Place } from '../domain/types';

/**
 * Korea-first place normalization.
 *
 * Provider responses (Nominatim today, possibly others later) are normalized
 * into our own `Place` type before they reach adapters/UI/the Decision Engine.
 * Display stays Korean: short `label` plus Korean administrative `subLabel`,
 * with country-level and global address components stripped.
 */

const KOREA_BBOX = {
  minLat: 33.05,
  maxLat: 38.7,
  minLon: 124.5,
  maxLon: 131.95,
} as const;

const HANGUL_RE = /[가-힣]/;

/** The seven major Korean city/province normalization expectations for tests. */
export const KOREA_METRO_SENDINGS = [
  '서울특별시',
  '부산광역시',
  '대전광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '제주특별자치도',
] as const;

function hasHangul(s: string): boolean {
  return HANGUL_RE.test(s);
}

export function isInKorea(lat: number, lon: number): boolean {
  return (
    lat >= KOREA_BBOX.minLat &&
    lat <= KOREA_BBOX.maxLat &&
    lon >= KOREA_BBOX.minLon &&
    lon <= KOREA_BBOX.maxLon
  );
}

const GLOBAL_SUFFIXES = [
  '대한민국',
  'South Korea',
  'Republic of Korea',
  'Korea, Republic of',
] as const;

/** Strip trailing global address components from a provider display string. */
export function stripGlobalComponents(displayName: string): string {
  let out = displayName.trim();
  for (const suffix of GLOBAL_SUFFIXES) {
    const re = new RegExp(`(?:,\\s*)?${suffix}$`, 'i');
    out = out.replace(re, '');
  }
  // trailing country code like ", kr" with the previous comma
  out = out.replace(/,\s*[A-Z]{2}$/i, '');
  // drop a dangling postcode
  out = out.replace(/,\s*\d{5}(-\d{4})?$/, '');
  return out.trim();
}

type NominatimAddress = Record<string, string | undefined>;

function pick(...vals: Array<string | undefined>): string | undefined {
  return vals.find((v): v is string => Boolean(v && v.trim()));
}

/**
 * Korean administrative sub-label. Examples:
 * - "서울특별시 중구"
 * - "경기도 고양시"
 * - "부산광역시 해운대구"
 * - "제주특별자치도"
 */
export function buildAdminLabel(address: NominatimAddress): string | undefined {
  const state = pick(address.state, address['state_district']);
  if (!state) return undefined;

  // municipality within a province (경기도 고양시)
  const city = pick(address.city, address['municipality']);
  const county = pick(address.county, address['municipality']);
  // district (구) is the more specific, tighter admin context
  const district = pick(address['city_district'], address['state_district'], address.district);

  // Special cities already include the borough in `state_district` (서울 중구).
  // Detect the special-city states (XX특별시 / XX광역시 / 제주특별자치도).
  const isSpecialOrProvince = /특별시|광역시|특별자치/.test(state);

  if (isSpecialOrProvince) {
    const borough = district && district !== state ? district : undefined;
    return borough ? `${state} ${borough}` : state;
  }

  const locality = pick(city, county);
  if (locality && locality !== state) {
    return `${state} ${locality}`;
  }
  return state;
}

function stationLike(type: string | undefined, extratags: Record<string, string> | undefined): boolean {
  return Boolean(
    type &&
      /station|subway|metro|train|bus_stop/i.test(type) ||
    extratags &&
      (extratags['railway'] === 'station' || extratags['station'] === 'subway_entrance'),
  );
}

function preferNameOverRoad(
  name: string | undefined,
  address: NominatimAddress,
  type: string | undefined,
): boolean {
  if (!name) return false;
  if (hasHangul(name)) return true;
  // Romanized name: accept only when Hangul-equivalent unavailable and it is not a bare road
  if (type === 'highway' || address['road'] === name) return false;
  return hasHangul(pick(address['amenity'], address['building'], address['tourism']) ?? '');
}

/**
 * Normalize one Nominatim (jsonv2) result into a `Place`.
 * Returns null for results outside Korea or without usable coordinates.
 */
export function normalizeNominatimPlace(raw: unknown): Place | null {
  const r = raw as Record<string, any>;
  const lat = Number(r?.lat);
  const lon = Number(r?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInKorea(lat, lon)) return null;

  const address: NominatimAddress = (r?.address ?? {}) as NominatimAddress;
  const country = pick(address['country'], address['country_code']);
  if (
    country &&
    !/대한민국|South Korea|Republic of Korea|^kr$/i.test(country)
  ) {
    return null; // not a Korean result
  }

  const extratags = (r?.extratags ?? undefined) as Record<string, string> | undefined;
  const name: string | undefined = typeof r?.name === 'string' ? r.name : undefined;
  const normalized = stripGlobalComponents(typeof r?.display_name === 'string' ? r.display_name : '');

  let label: string | undefined;

  if (preferNameOverRoad(name, address, r?.type)) {
    label = name;
  } else if (stationLike(r?.type, extratags)) {
    label = pick(address['railway'], address['subway'], address['amenity'], name);
  } else {
    label = pick(
      address['building'],
      address['amenity'],
      address['tourism'],
      address['office'],
      address['shop'],
      address['railway'],
      address['subway'],
      address['public_transport'],
      address['road'],
      name,
    );
  }

  if (!label || !label.trim()) {
    // Last resort: leading segment of the stripped display name
    label = normalized.split(',')[0] ?? name;
  }

  const subLabel = buildAdminLabel(address);

  // Prefer Korean label; fall back to the provided (possibly Romanized) name.
  const finalLabel = hasHangul(label) ? label : (name ?? label);

  return {
    label: finalLabel.trim(),
    subLabel,
    coordinate: { latitude: lat, longitude: lon },
    source: 'nominatim',
  };
}

/** Ambiguity hint used to dedupe identical labels from one geocoding response. */
export function dedupePlaces(places: Place[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const p of places) {
    const key = `${p.label}|${p.subLabel ?? ''}|${p.coordinate.latitude.toFixed(4)}|${p.coordinate.longitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * Normalize a Nominatim reverse-geocoding (jsonv2) response into a `Place`.
 * Builds a short road/building label and a Korean administrative subLabel from
 * the `address` object. Returns null outside Korea or without coordinates.
 */
export function normalizeNominatimReverse(raw: unknown): Place | null {
  const r = raw as Record<string, any>;
  const lat = Number(r?.lat);
  const lon = Number(r?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInKorea(lat, lon)) return null;

  const address: NominatimAddress = (r?.address ?? {}) as NominatimAddress;

  const label = pick(
    address['building'],
    address['amenity'],
    address['tourism'],
    address['office'],
    address['shop'],
    address['railway'],
    address['subway'],
    address['public_transport'],
    address['road'],
  );

  const normalized = stripGlobalComponents(typeof r?.display_name === 'string' ? r.display_name : '');
  const hasKorean = hasHangul(label ?? '');
  const fallback = normalized.split(',')[0] ?? '';
  const finalLabel = hasKorean && label ? label : ((label ?? fallback) || '좌표 위치');

  if (!finalLabel.trim()) return null;

  return {
    label: finalLabel.trim(),
    subLabel: buildAdminLabel(address),
    coordinate: { latitude: lat, longitude: lon },
    source: 'nominatim',
  };
}