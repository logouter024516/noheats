import { useState, useCallback } from 'react';

import { Place, Recommendation, Timings, WeatherSnapshot } from '../domain/types';
import { rank } from '../domain/engine';
import { dedupeTransitOptions } from '../domain/dedupe';
import { fetchWeather } from '../adapters/weather';
import { fetchWalkingRoutes } from '../adapters/walking';
import { fetchTransitRoutes } from '../adapters/transit';
import { fetchDrivingRoutes } from '../adapters/driving';
import { kstNow, shiftMinutes } from '../korea/time';

export type InputState = {
  origin: Place | null;
  destination: Place | null;
  arrivalTime: string; // ISO 8601 +09:00
};

export type DepartureOffset = -10 | 0 | 10;

export type DataStatus = 'idle' | 'live' | 'partial' | 'error';

export type SourceStatus = {
  weather: 'live' | 'estimated' | 'failed';
  walking: 'live' | 'none' | 'failed';
  transit: 'live' | 'demo' | 'failed' | 'none';
  driving: 'live' | 'failed' | 'none';
};

export type AppState = {
  input: InputState;
  isLoading: boolean;
  recommendation: Recommendation | null;
  error: string | null;
  weather: WeatherSnapshot | null;
  selectedRouteId: string | null;
  departureOffset: DepartureOffset;
  dataStatus: DataStatus;
  sourceStatus: SourceStatus;
  timings: Timings;
  transitNote: string | null;
};

function defaultArrival(): string {
  return shiftMinutes(kstNow(), 30);
}

const ESTIMATED_WEATHER: WeatherSnapshot = {
  observedAt: kstNow(),
  temperatureC: 28,
  apparentTemperatureC: 28,
  uvIndex: undefined,
  source: '추정 (실시간 날씨 로드 실패)',
  dataQuality: 'estimated',
};

async function timed<T>(label: keyof Timings, timings: Record<string, number>, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const value = await fn();
    timings[label] = Math.round(performance.now() - start);
    return value;
  } catch (err) {
    timings[label] = Math.round(performance.now() - start);
    throw err;
  }
}

export function useHeatPizza() {
  const [state, setState] = useState<AppState>({
    input: { origin: null, destination: null, arrivalTime: defaultArrival() },
    isLoading: false,
    recommendation: null,
    error: null,
    weather: null,
    selectedRouteId: null,
    departureOffset: 0,
    dataStatus: 'idle',
    sourceStatus: { weather: 'failed', walking: 'failed', transit: 'none', driving: 'none' },
    timings: {},
    transitNote: null,
  });

  const invalidate = (p: Partial<AppState>) => ({
    ...p,
    recommendation: null,
    weather: null,
    selectedRouteId: null,
    error: null,
    dataStatus: 'idle' as const,
    timings: {},
    transitNote: null,
  });

  const setOrigin = useCallback((origin: Place | null) => {
    setState((s) => ({ ...s, ...invalidate({ input: { ...s.input, origin } }) }));
  }, []);

  const setDestination = useCallback((destination: Place | null) => {
    setState((s) => ({ ...s, ...invalidate({ input: { ...s.input, destination } }) }));
  }, []);

  const setArrivalTime = useCallback((time: string) => {
    setState((s) => ({ ...s, input: { ...s.input, arrivalTime: time } }));
  }, []);

  const setDepartureOffset = useCallback((offset: DepartureOffset) => {
    setState((s) => ({ ...s, departureOffset: offset }));
  }, []);

  const selectRoute = useCallback((id: string) => {
    setState((s) => ({ ...s, selectedRouteId: id }));
  }, []);

  const search = useCallback(
    async (overrides?: Partial<InputState>, options?: { departureOffset?: DepartureOffset }) => {
      const { origin, destination, arrivalTime } = { ...state.input, ...overrides };
      if (!origin || !destination) {
        setState((s) => ({ ...s, error: '출발지와 도착지를 모두 입력해주세요' }));
        return;
      }

      setState((s) => ({
        ...s,
        input: overrides ? { ...s.input, ...overrides } : s.input,
        isLoading: true,
        error: null,
      }));

      const offset = options?.departureOffset ?? state.departureOffset;
      const effectiveArrival = shiftMinutes(arrivalTime, offset);

      const t0 = performance.now();
      const timings: Record<string, number> = {};

      const [weatherResult, walkResult, transitResult, drivingResult] = await Promise.allSettled([
        timed('weatherMs', timings, () => fetchWeather(origin.coordinate.latitude, origin.coordinate.longitude)),
        timed('walkingMs', timings, () => fetchWalkingRoutes(origin, destination, effectiveArrival)),
        timed('transitMs', timings, () => fetchTransitRoutes(origin, destination, effectiveArrival)),
        timed('drivingMs', timings, () => fetchDrivingRoutes(origin, destination, effectiveArrival)),
      ]);

      const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : ESTIMATED_WEATHER;
      const walk = walkResult.status === 'fulfilled' ? walkResult.value : [];
      const transit = transitResult.status === 'fulfilled' ? dedupeTransitOptions(transitResult.value) : [];
      const driving = drivingResult.status === 'fulfilled' ? drivingResult.value : [];

      const noteParts: string[] = [];
      if (transitResult.status === 'rejected') {
        noteParts.push(transitResult.reason instanceof Error ? transitResult.reason.message : '대중교통 실시간 정보를 가져오지 못했습니다.');
      }
      if (drivingResult.status === 'rejected') {
        noteParts.push(drivingResult.reason instanceof Error ? drivingResult.reason.message : '자동차 실시간 정보를 가져오지 못했습니다.');
      }
      const transitNote = noteParts.length > 0 ? noteParts.join('\n') : null;

      const allRoutes = [...walk, ...transit, ...driving];

      const sourceStatus: SourceStatus = {
        weather: weatherResult.status === 'fulfilled' ? 'live' : 'estimated',
        walking: walkResult.status === 'fulfilled' ? (walk.length ? 'live' : 'none') : 'failed',
        transit: transitResult.status === 'fulfilled' ? (transit.length ? 'live' : 'none') : 'failed',
        driving: drivingResult.status === 'fulfilled' ? (driving.length ? 'live' : 'none') : 'failed',
      };

      if (allRoutes.length === 0) {
        timings['totalMs'] = Math.round(performance.now() - t0);
        setState((s) => ({
          ...s,
          isLoading: false,
          weather,
          error: '경로를 찾을 수 없습니다. 출발지와 도착지를 확인해주세요.',
          dataStatus: 'error',
          sourceStatus,
          timings: { ...timings },
          transitNote,
        }));
        return;
      }

      const tRankStart = performance.now();
      const recommendation = rank(allRoutes, weather, {
        dataStatus: 'partial',
      });
      timings['decisionEngineMs'] = Math.round(performance.now() - tRankStart);
      timings['totalMs'] = Math.round(performance.now() - t0);

      const hasLive = {
        weather: weatherResult.status === 'fulfilled',
        walking: walkResult.status === 'fulfilled' && walk.length > 0,
        transit: transitResult.status === 'fulfilled' && transit.length > 0,
        driving: drivingResult.status === 'fulfilled' && driving.length > 0,
      };
      const liveCount = Object.values(hasLive).filter(Boolean).length;

      let dataStatus: AppState['dataStatus'] = 'partial';
      if (liveCount === 4) dataStatus = 'live';

      setState((s) => ({
        ...s,
        isLoading: false,
        recommendation,
        weather,
        selectedRouteId: recommendation.recommended.id,
        dataStatus,
        sourceStatus,
        timings: { ...timings },
        transitNote,
      }));
    },
    [state.input, state.departureOffset],
  );

  const reset = useCallback(() => {
    setState({
      input: { origin: null, destination: null, arrivalTime: defaultArrival() },
      isLoading: false,
      recommendation: null,
      error: null,
      weather: null,
      selectedRouteId: null,
      departureOffset: 0,
      dataStatus: 'idle',
sourceStatus: { weather: 'failed', walking: 'failed', transit: 'none', driving: 'none' },
      timings: {},
      transitNote: null,
    });
  }, []);

  return {
    ...state,
    setOrigin,
    setDestination,
    setArrivalTime,
    setDepartureOffset,
    selectRoute,
    search,
    reset,
  };
}