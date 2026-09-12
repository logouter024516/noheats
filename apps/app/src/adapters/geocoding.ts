import { Place } from '../domain/types';
import { GeocodingProvider, ReverseGeocodingProvider } from '../providers/types';
import {
  normalizeNominatimPlace,
  normalizeNominatimReverse,
  dedupePlaces,
} from '../korea/place';
import { apiUrl } from '../utils/apiUrl';

const PROXY_ENDPOINT = apiUrl('/api/places');

const PROXY_REVERSE_ENDPOINT = apiUrl('/api/reverse');

/**
 * Korea-first geocoding. Tries Kakao Local (via the keyed proxy) for far
 * better Korean place/POI coverage, and degrades to Nominatim when the proxy
 * is unreachable or the Kakao key is not configured. Never fabricates places.
 * Single-character queries skip the Nominatim fallback (Nominatim returns
 * noisy street matches for one Hangul syllable).
 */
export async function searchPlaces(query: string): Promise<Place[]> {
  try {
    const places = await kakaoGeocoding.search(query);
    if (places.length > 0) return places;
  } catch {
    // proxy missing, key unset, or Kakao unreachable — fall back below
  }
  if (query.trim().length < 2) return [];
  return nominatimGeocoding.search(query);
}

/**
 * Best-effort label for a map pin at (lat, lon). Prefers the Kakao proxy
 * reverse geocoder; falls back to Nominatim. Returns null when neither gives
 * a usable name so the caller can fall back to raw coordinates.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<Place | null> {
  try {
    const place = await kakaoReverseGeocoding.reverse(lat, lon);
    if (place) return place;
  } catch {
    // proxy missing or Kakao unreachable — Nominatim below
  }
  return nominatimReverseGeocoding.reverse(lat, lon);
}

export const kakaoGeocoding: GeocodingProvider = {
  name: 'Kakao Local',

  async search(query: string): Promise<Place[]> {
    if (!query.trim()) return [];

    const res = await fetch(`${PROXY_ENDPOINT}?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Place search failed: ${res.status}`);
    const json: unknown = await res.json();
    const docs = (json as { places?: unknown[] })?.places;
    if (!Array.isArray(docs)) return [];

    // The proxy already normalizes Kakao docs into Place shape; validate, don't re-normalize.
    const places = docs
      .map((raw: unknown): Place | null => {
        const p = raw as Partial<Place>;
        if (
          typeof p?.label !== 'string' ||
          !p.label.trim() ||
          !p.coordinate ||
          !Number.isFinite(p.coordinate.latitude) ||
          !Number.isFinite(p.coordinate.longitude)
        ) {
          return null;
        }
        return p as Place;
      })
      .filter((p): p is Place => p !== null);

    return dedupePlaces(places).slice(0, 8);
  },
};

export const kakaoReverseGeocoding: ReverseGeocodingProvider = {
  name: 'Kakao Local',

  async reverse(lat: number, lon: number): Promise<Place | null> {
    const res = await fetch(`${PROXY_REVERSE_ENDPOINT}?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error(`Reverse failed: ${res.status}`);
    const json: unknown = await res.json();
    const raw = (json as { place?: unknown })?.place;
    if (raw == null) return null;
    const p = raw as Partial<Place>;
    if (
      typeof p?.label !== 'string' ||
      !p.label.trim() ||
      !p.coordinate ||
      !Number.isFinite(p.coordinate.latitude) ||
      !Number.isFinite(p.coordinate.longitude)
    ) {
      return null;
    }
    return p as Place;
  },
};

export const nominatimReverseGeocoding: ReverseGeocodingProvider = {
  name: 'Nominatim',

  async reverse(lat: number, lon: number): Promise<Place | null> {
    const url =
      'https://nominatim.openstreetmap.org/reverse' +
      `?lat=${lat}&lon=${lon}` +
      '&format=jsonv2' +
      '&accept-language=ko' +
      '&addressdetails=1';

    const res = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
    if (!res.ok) throw new Error(`Reverse failed: ${res.status}`);
    const data: unknown = await res.json();
    return normalizeNominatimReverse(data);
  },
};

export const nominatimGeocoding: GeocodingProvider = {
  name: 'Nominatim',

  async search(query: string): Promise<Place[]> {
    if (!query.trim()) return [];

    const url =
      'https://nominatim.openstreetmap.org/search' +
      `?q=${encodeURIComponent(query)}` +
      '&format=jsonv2' +
      '&limit=5' +
      '&accept-language=ko' +
      '&extratags=1' +
      '&addressdetails=1';

    const res = await fetch(url, { headers: { 'Accept-Language': 'ko' } });
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const places = data
      .map((raw: unknown) => normalizeNominatimPlace(raw))
      .filter((p): p is Place => p !== null);

    return dedupePlaces(places).slice(0, 5);
  },
};