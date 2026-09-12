import React, { useRef, useEffect, useState } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Place, ScoredOption } from '../domain/types';

const SEOUL_CENTER = { latitude: 37.5663, longitude: 126.9829 };

type Props = {
  origin: Place | null;
  destination: Place | null;
  routes: ScoredOption[];
  selectedId: string | null;
  recommendedId: string | null;
  currentLocation?: Place | null;
  /** Called with (lat, lon) when the user taps the map to drop a pin. */
  onMapClick?: (lat: number, lon: number) => void;
};

/**
 * Kakao Map JS SDK key (client-visible, like a Google Maps JS key — not a
 * secret). Put it in `apps/app/.env.local` as EXPO_PUBLIC_KAKAO_MAP_JS_KEY and
 * allowlist the serving domain in the Kakao Developers console. When unset,
 * the map renders with Leaflet + OSM instead.
 */
const KAKAO_MAP_JS_KEY =
  typeof process !== 'undefined' ? (process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY ?? '') : '';

type KakaoNamespace = any;

let kakaoSdkPromise: Promise<KakaoNamespace> | null = null;

function getKakaoSdk(): Promise<KakaoNamespace> {
  if (kakaoSdkPromise) return kakaoSdkPromise;
  kakaoSdkPromise = new Promise((resolve, reject) => {
    const win = window as any;
    if (win.kakao?.maps) return resolve(win.kakao);
    const s = document.createElement('script');
    s.src =
      `https://dapi.kakao.com/v2/maps/sdk.js` +
      `?appkey=${encodeURIComponent(KAKAO_MAP_JS_KEY)}` +
      `&autoload=false&libraries=services`;
    s.async = true;
    s.onload = () =>
      win.kakao?.maps?.load
        ? win.kakao.maps.load(() => resolve(win.kakao))
        : reject(new Error('kakao maps unavailable'));
    s.onerror = () => reject(new Error('kakao sdk load failed'));
    document.head.appendChild(s);
  });
  return kakaoSdkPromise;
}

export function RealMap(props: Props) {
  return KAKAO_MAP_JS_KEY ? <KakaoWebMap {...props} /> : <LeafletWebMap {...props} />;
}

type MarkerKind = '출발' | '도착' | '현재 위치';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Popup card styled to match the app's system UI (radius 10, #D9DDE3 border,
 * --font-display stack, compact 10/13px type). Right padding leaves room for
 * the popup close button. Used by both the Kakao InfoWindow (customContent)
 * and the Leaflet popup.
 */
function popupHtml(kind: MarkerKind, label: string): string {
  const titleColor = kind === '현재 위치' ? '#3B82F6' : '#2563EB';
  return (
    '<div style="min-width:150px;max-width:220px;background:#FFFFFF;border:1px solid #D9DDE3;' +
    'border-radius:10px;padding:8px 26px 8px 12px;' +
    'font-family:var(--font-display),Spline Sans,Inter,system-ui,sans-serif;' +
    'box-shadow:0 2px 10px rgba(17,19,24,0.10);">' +
    `<div style="font-size:10px;font-weight:700;letter-spacing:0.8px;color:${titleColor};margin-bottom:2px;">${escapeHtml(kind)}</div>` +
    `<div style="font-size:13px;font-weight:600;color:#111318;line-height:1.4;">${escapeHtml(label)}</div>` +
    '</div>'
  );
}

/** Accuracy-aware circle radius in meters, clamped to keep the dot legible. */
function locationRadiusKm(accuracy?: number): number {
  const acc = typeof accuracy === 'number' && accuracy > 0 ? accuracy : 90;
  return Math.min(Math.max(acc, 60), 1500);
}

function toLatLng(k: KakaoNamespace, lat: number, lon: number) {
  return new k.maps.LatLng(lat, lon);
}

function KakaoWebMap({ origin, destination, routes, selectedId, recommendedId, currentLocation, onMapClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoNamespace | null>(null);
  const kRef = useRef<KakaoNamespace | null>(null);
  const markerRefs = useRef<KakaoNamespace[]>([]);
  const polyRefs = useRef<KakaoNamespace[]>([]);
  const circleRefs = useRef<KakaoNamespace[]>([]);
  const iwRefs = useRef<KakaoNamespace[]>([]);
  const initRef = useRef(false);
  const onMapClickRef = useRef(onMapClick);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    let cancelled = false;
    getKakaoSdk()
      .then((k) => {
        if (cancelled || !containerRef.current) return;
        kRef.current = k;
        try {
          mapRef.current = new k.maps.Map(containerRef.current, {
            center: toLatLng(k, SEOUL_CENTER.latitude, SEOUL_CENTER.longitude),
            level: 7,
          });
        } catch {
          setFailed(true);
          return;
        }
        if (onMapClickRef.current) {
          k.maps.event.addListener(mapRef.current, 'click', (ev: any) => {
            if (onMapClickRef.current) {
              onMapClickRef.current(ev.latLng.getLat(), ev.latLng.getLng());
            }
          });
        }
        // Domain/key mismatch renders an empty container instead of throwing.
        // Detect it and fall back to Leaflet.
        setTimeout(() => {
          if (cancelled || !containerRef.current || containerRef.current.childElementCount === 0) {
            setFailed(true);
          }
        }, 800);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const k = kRef.current;
    if (!map || !k) return;

    const pts = [] as KakaoNamespace[];
    if (origin) pts.push(toLatLng(k, origin.coordinate.latitude, origin.coordinate.longitude));
    if (destination) pts.push(toLatLng(k, destination.coordinate.latitude, destination.coordinate.longitude));
    if (pts.length > 0) {
      if (pts.length === 1) {
        // A single point has no meaningful bounds; center on it at a readable zoom.
        map.setCenter(pts[0]);
        map.setLevel(5);
      } else {
        const bounds = new k.maps.LatLngBounds();
        for (const p of pts) bounds.extend(p);
        map.setBounds(bounds, 60, 60, 60, 60);
      }
    }
  }, [origin, destination]);

  useEffect(() => {
    const map = mapRef.current;
    const k = kRef.current;
    if (!map || !k) return;

    for (const m of markerRefs.current) m.setMap(null);
    for (const i of iwRefs.current) i.close();
    markerRefs.current = [];
    iwRefs.current = [];

    const add = (lat: number, lon: number, kind: MarkerKind, label: string) => {
      const m = new k.maps.Marker({ position: toLatLng(k, lat, lon), title: label });
      m.setMap(map);
      const iw = new k.maps.InfoWindow({ content: popupHtml(kind, label), customContent: true });
      iw.open(map, m);
      markerRefs.current.push(m);
      iwRefs.current.push(iw);
    };

    if (origin) add(origin.coordinate.latitude, origin.coordinate.longitude, '출발', origin.label);
    if (destination) add(destination.coordinate.latitude, destination.coordinate.longitude, '도착', destination.label);
  }, [origin, destination]);

  useEffect(() => {
    const map = mapRef.current;
    const k = kRef.current;
    if (!map || !k) return;

    for (const c of circleRefs.current) c.setMap(null);
    circleRefs.current = [];

    if (currentLocation) {
      const pt = toLatLng(k, currentLocation.coordinate.latitude, currentLocation.coordinate.longitude);
      const c = new k.maps.Circle({
        center: pt,
        radius: locationRadiusKm(currentLocation.accuracy),
        strokeColor: '#2563EB',
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: '#3B82F6',
        fillOpacity: 0.35,
      });
      c.setMap(map);
      try {
        const iw = new k.maps.InfoWindow({
          content: popupHtml('현재 위치', currentLocation.label),
          position: pt,
          customContent: true,
        });
        iw.open(map);
        iwRefs.current.push(iw);
      } catch {
        // InfoWindow anchored to nothing but a position is the supported path.
      }
      circleRefs.current.push(c);
      map.setCenter(pt);
    }
  }, [currentLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const k = kRef.current;
    if (!map || !k) return;

    for (const p of polyRefs.current) p.setMap(null);
    polyRefs.current = [];

    for (const route of routes) {
      if (!route.geometry || route.geometry.length < 2) continue;
      const path = route.geometry.map((c) => toLatLng(k, c.latitude, c.longitude));
      const isSelected = route.id === selectedId;
      const isRecommended = route.id === recommendedId;
      const poly = new k.maps.Polyline({
        path,
        strokeColor: isSelected ? '#2563EB' : isRecommended ? '#3B82F6' : '#94A3B8',
        strokeWeight: isSelected ? 5 : isRecommended ? 4 : 2,
        strokeOpacity: isSelected ? 1 : isRecommended ? 0.9 : 0.45,
        strokeStyle: route.mode === 'walk' ? 'dash' : 'solid',
      });
      poly.setMap(map);
      polyRefs.current.push(poly);
    }
  }, [routes, selectedId, recommendedId]);

  if (failed) return <LeafletWebMap origin={origin} destination={destination} routes={routes} selectedId={selectedId} recommendedId={recommendedId} currentLocation={currentLocation} onMapClick={onMapClick} />;

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && <div ref={containerRef as any} style={{ width: '100%', height: '100%' }} />}
    </View>
  );
}

function LeafletWebMap({ origin, destination, routes, selectedId, recommendedId, currentLocation, onMapClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<L.Marker[]>([]);
  const polylineRefs = useRef<L.Polyline[]>([]);
  const circleRefs = useRef<L.Circle[]>([]);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const map = L.map(containerRef.current, {
      center: [SEOUL_CENTER.latitude, SEOUL_CENTER.longitude],
      zoom: 14,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (onMapClickRef.current) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (onMapClickRef.current) onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRefs.current = [];
      polylineRefs.current = [];
      circleRefs.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const points: L.LatLngExpression[] = [];
    if (origin) points.push([origin.coordinate.latitude, origin.coordinate.longitude]);
    if (destination) points.push([destination.coordinate.latitude, destination.coordinate.longitude]);

    if (points.length === 1) {
      map.setView(points[0], 15);
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.15));
    }
  }, [origin, destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];

    if (origin) {
      const m = L.marker([origin.coordinate.latitude, origin.coordinate.longitude], {
        title: origin.label,
      }).addTo(map);
      m.bindPopup(popupHtml('출발', origin.label), { className: 'hp-popup' });
      markerRefs.current.push(m);
    }

    if (destination) {
      const m = L.marker([destination.coordinate.latitude, destination.coordinate.longitude], {
        title: destination.label,
      }).addTo(map);
      m.bindPopup(popupHtml('도착', destination.label), { className: 'hp-popup' });
      markerRefs.current.push(m);
    }
  }, [origin, destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    circleRefs.current.forEach((c) => c.remove());
    circleRefs.current = [];

    if (currentLocation) {
      const latlng: [number, number] = [
        currentLocation.coordinate.latitude,
        currentLocation.coordinate.longitude,
      ];
      const circle = L.circle(latlng, {
        radius: locationRadiusKm(currentLocation.accuracy),
        color: '#2563EB',
        fillColor: '#3B82F6',
        fillOpacity: 0.35,
        weight: 2,
      }).addTo(map);
      circle.bindPopup(popupHtml('현재 위치', currentLocation.label), { className: 'hp-popup' });
      circleRefs.current.push(circle);
      map.panTo(latlng);
    }
  }, [currentLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    polylineRefs.current.forEach((p) => p.remove());
    polylineRefs.current = [];

    for (const route of routes) {
      if (!route.geometry || route.geometry.length < 2) continue;
      const latlngs = route.geometry.map(
        (c) => [c.latitude, c.longitude] as [number, number],
      );
      const isSelected = route.id === selectedId;
      const isRecommended = route.id === recommendedId;
      const poly = L.polyline(latlngs, {
        color: isSelected ? '#2563EB' : isRecommended ? '#3B82F6' : '#94A3B8',
        weight: isSelected ? 5 : isRecommended ? 4 : 2,
        opacity: isSelected ? 1 : isRecommended ? 0.9 : 0.45,
        dashArray: route.mode === 'walk' ? '4,6' : undefined,
      }).addTo(map);
      polylineRefs.current.push(poly);
    }
  }, [routes, selectedId, recommendedId]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && <div ref={containerRef as any} style={{ width: '100%', height: '100%' }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill as any,
  },
});