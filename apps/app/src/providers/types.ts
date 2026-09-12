import { Place, RouteOption, WeatherSnapshot } from '../domain/types';

/**
 * Provider boundaries. Adapters implement these; the Decision Engine and UI only
 * consume normalized domain types and never see provider-specific shapes
 * (ODsay / Nominatim / Open-Meteo).
 */
export interface WeatherProvider {
  name: string;
  fetch(lat: number, lon: number, at?: string): Promise<WeatherSnapshot>;
}

export interface GeocodingProvider {
  name: string;
  search(query: string): Promise<Place[]>;
}

export interface ReverseGeocodingProvider {
  name: string;
  reverse(lat: number, lon: number): Promise<Place | null>;
}

export interface WalkingRouteProvider {
  name: string;
  fetch(origin: Place, destination: Place, arrivalAt: string): Promise<RouteOption[]>;
}

export interface TransitProvider {
  name: string;
  fetch(origin: Place, destination: Place, arrivalAt: string): Promise<RouteOption[]>;
}

export interface DrivingRouteProvider {
  name: string;
  fetch(origin: Place, destination: Place, arrivalAt: string): Promise<RouteOption[]>;
}