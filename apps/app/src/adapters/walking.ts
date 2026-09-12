import { RouteOption, Place } from '../domain/types';
import { WalkingRouteProvider } from '../providers/types';
import { kstNow, toKstIso } from '../korea/time';

export async function fetchWalkingRoutes(
  origin: Place,
  destination: Place,
  arrivalTime: string,
): Promise<RouteOption[]> {
  return osrmFoot.fetch(origin, destination, arrivalTime);
}

/**
 * OSRM foot profile via routing.openstreetmap.de.
 * Note: this is a road-network profile with pedestrian weighting; it cannot
 * guarantee sidewalk/pedestrian-only infrastructure. Quality is marked 'live'
 * for availability but Korea-specific walking caveats are documented in
 * docs/KOREA-OPTIMIZATION.md.
 */
export const osrmFoot: WalkingRouteProvider = {
  name: 'OSRM (routed-foot)',

  async fetch(origin: Place, destination: Place, arrivalTime: string): Promise<RouteOption[]> {
    const coords = [
      `${origin.coordinate.longitude},${origin.coordinate.latitude}`,
      `${destination.coordinate.longitude},${destination.coordinate.latitude}`,
    ].join(';');

    const url =
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving/' +
      coords +
      '?overview=full&geometries=geojson&steps=true';

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Walking route failed: ${res.status}`);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) return [];

    const r = data.routes[0];
    const durationMin = Math.round(r.duration / 60);
    const geometry = r.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon }),
    );

    const arrivalMs = new Date(arrivalTime).getTime();
    const departure = toKstIso(arrivalMs - r.duration * 1000);

    return [
      {
        id: `walk-${kstNow()}`,
        mode: 'walk',
        label: '도보',
        durationMin,
        walkMin: durationMin,
        waitMin: 0,
        transfers: 0,
        geometry,
        departureAt: departure,
        arrivalAt: arrivalTime,
        source: 'OSRM (routed-foot)',
        dataQuality: 'live',
        segments: [
          {
            mode: 'walk',
            label: '도보',
            durationMin,
            outdoor: true,
          },
        ],
      },
    ];
  },
};