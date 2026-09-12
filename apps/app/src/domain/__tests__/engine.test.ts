import { rank } from '../engine';
import {
  HOT_WEATHER,
  MILD_WEATHER,
  EULJIRO_TO_SEOUL_STATION,
} from '../fixtures';
import { RouteOption, WeatherSnapshot } from '../types';

const walkRoute: RouteOption = {
  id: 'walk',
  mode: 'walk',
  label: '도보',
  durationMin: 30,
  walkMin: 30,
  waitMin: 0,
  transfers: 0,
  departureAt: '2026-09-10T14:00:00+09:00',
  arrivalAt: '2026-09-10T14:30:00+09:00',
  source: 'test',
  dataQuality: 'demo' as const,
};

const transitRoute: RouteOption = {
  id: 'transit',
  mode: 'transit',
  label: '지하철',
  durationMin: 22,
  walkMin: 6,
  waitMin: 4,
  transfers: 0,
  departureAt: '2026-09-10T14:00:00+09:00',
  arrivalAt: '2026-09-10T14:22:00+09:00',
  source: 'test',
  dataQuality: 'demo' as const,
};

describe('rank', () => {
  it('recommends the fastest route when heat is not a factor', () => {
    const result = rank([walkRoute, transitRoute], MILD_WEATHER);
    expect(result.recommended.id).toBe('transit');
    expect(result.fastestBaseline.id).toBe('transit');
  });

  it('may diverge from fastest when heat exposure differs', () => {
    const fastWalk: RouteOption = {
      ...walkRoute,
      id: 'walk-fast',
      durationMin: 18,
      walkMin: 18,
      waitMin: 0,
    };
    const transitShady: RouteOption = {
      ...transitRoute,
      id: 'transit-shady',
      durationMin: 24,
      walkMin: 4,
      waitMin: 3,
    };

    const result = rank([fastWalk, transitShady], {
      ...HOT_WEATHER,
      temperatureC: 36,
      apparentTemperatureC: 42,
    });

    expect(result.fastestBaseline.id).toBe('walk-fast');
    expect(result.recommended.id).toBe('transit-shady');
  });

  it('reports outdoor exposure and reasons', () => {
    const result = rank([transitRoute], HOT_WEATHER);
    expect(result.recommended.outdoorExposureMin).toBe(10);
    expect(result.recommended.reasons.length).toBeGreaterThan(0);
  });

  it('keeps fastest baseline when recommended differs', () => {
    const result = rank(EULJIRO_TO_SEOUL_STATION, HOT_WEATHER);
    const fastest = [...EULJIRO_TO_SEOUL_STATION].sort(
      (a, b) => a.durationMin - b.durationMin,
    )[0];
    expect(result.fastestBaseline.id).toBe(fastest.id);
    expect(result.recommended.decisionScore).toBeLessThanOrEqual(
      result.fastestBaseline.decisionScore,
    );
  });

  it('sorts alternatives after the winner', () => {
    const result = rank(EULJIRO_TO_SEOUL_STATION, HOT_WEATHER);
    for (const alt of result.alternatives) {
      expect(alt.decisionScore).toBeGreaterThanOrEqual(result.recommended.decisionScore);
    }
  });

  it('includes assumptions and marks data as demo', () => {
    const result = rank([walkRoute, transitRoute], MILD_WEATHER);
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.dataStatus).toBe('demo');
  });

  it('is deterministic for the same input', () => {
    const a = rank(EULJIRO_TO_SEOUL_STATION, HOT_WEATHER);
    const b = rank(EULJIRO_TO_SEOUL_STATION, HOT_WEATHER);
    expect(a.recommended.decisionScore).toBe(b.recommended.decisionScore);
    expect(a.recommended.id).toBe(b.recommended.id);
  });

  it('handles missing apparent temperature by using ambient', () => {
    const noFeelsLike: WeatherSnapshot = { ...HOT_WEATHER, apparentTemperatureC: undefined };
    const result = rank([walkRoute], noFeelsLike);
    expect(result.recommended.heatIntensity).toBeGreaterThan(0);
  });

  it('throws on empty route list', () => {
    expect(() => rank([], HOT_WEATHER)).toThrow();
  });
});