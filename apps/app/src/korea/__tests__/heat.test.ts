import {
  computeExposureBreakdown,
  computeOutdoorExposureMinutes,
  computeHeatIntensity,
  computeHeatBurden,
  heatWeightFor,
} from '../heat';
import {
  HOT_WEATHER,
  MILD_WEATHER,
  EULJIRO_TO_SEOUL_STATION,
  EULJIRO_TO_GANGNAM,
} from '../../domain/fixtures';
import { RouteOption } from '../../domain/types';

describe('korea/heat — outdoor-only exposure model', () => {
  it('counts a pure walk route as fully outdoor', () => {
    const route = EULJIRO_TO_SEOUL_STATION[0]; // walk-1, 35분
    const e = computeExposureBreakdown(route);
    expect(e.walkingOutdoorMin).toBe(35);
    expect(e.indoorMin).toBe(0);
    expect(computeOutdoorExposureMinutes(route)).toBe(35);
  });

  it('treats subway waiting as sheltered (underground)', () => {
    const route = EULJIRO_TO_SEOUL_STATION[1]; // transit-1: walk 8 + subway 9, wait 5
    const e = computeExposureBreakdown(route);
    expect(e.walkingOutdoorMin).toBe(8);
    expect(e.waitingShelteredMin).toBe(5);
    expect(e.waitingOutdoorMin).toBe(0);
    expect(e.indoorMin).toBe(9);
    expect(computeOutdoorExposureMinutes(route)).toBe(8);
  });

  it('treats bus waiting as outdoor', () => {
    const route = EULJIRO_TO_SEOUL_STATION[2]; // transit-2: walk 6 + bus 14, wait 8
    const e = computeExposureBreakdown(route);
    expect(e.waitingOutdoorMin).toBe(8);
    expect(e.indoorMin).toBe(14);
    expect(computeOutdoorExposureMinutes(route)).toBe(14);
  });

  it('sums a two-walk-segment transfer route conservatively', () => {
    const route = EULJIRO_TO_GANGNAM[2]; // transit-gn-2: walk 5+5, bus 15, wait 7
    const e = computeExposureBreakdown(route);
    expect(e.walkingOutdoorMin).toBe(10);
    expect(e.waitingOutdoorMin).toBe(7);
    expect(computeOutdoorExposureMinutes(route)).toBe(17);
  });

  it('derives from aggregates when segments are absent', () => {
    const bare: RouteOption = {
      id: 'bare',
      mode: 'transit',
      label: '지하철',
      durationMin: 22,
      walkMin: 6,
      waitMin: 4,
      transfers: 0,
      departureAt: '2026-09-10T14:00:00+09:00',
      arrivalAt: '2026-09-10T14:22:00+09:00',
      source: 'test',
      dataQuality: 'demo',
    };
    const e = computeExposureBreakdown(bare);
    expect(e.walkingOutdoorMin).toBe(6);
    // no segments ⇒ default is conservative: all waiting counted outdoor
    expect(e.waitingOutdoorMin).toBe(4);
    expect(e.indoorMin).toBe(12);
  });
});

describe('korea/heat — heat intensity, burden, weights', () => {
  it('weights apparent temperature, humidity and UV into 0–100', () => {
    const hot = computeHeatIntensity(HOT_WEATHER);
    const mild = computeHeatIntensity(MILD_WEATHER);
    expect(hot).toBeGreaterThan(mild);
    expect(hot).toBeGreaterThanOrEqual(0);
    expect(hot).toBeLessThanOrEqual(100);
  });

  it('falls back to ambient temperature when apparent is missing', () => {
    const noFeels = computeHeatIntensity({ ...HOT_WEATHER, apparentTemperatureC: undefined });
    expect(noFeels).toBeGreaterThan(0);
  });

  it('gives wind relief and precipitation penalty', () => {
    const calm = computeHeatIntensity({ ...HOT_WEATHER, windMps: 1 });
    const breezy = computeHeatIntensity({ ...HOT_WEATHER, windMps: 4 });
    expect(breezy).toBeLessThan(calm);
    const withRain = computeHeatIntensity({ ...HOT_WEATHER, precipitationProbability: 90 });
    expect(withRain).toBeGreaterThan(calm);
  });

  it('binds burden to 0–100 and scales with both minutes and intensity', () => {
    expect(computeHeatBurden(0, 100)).toBe(0);
    expect(computeHeatBurden(60, 100)).toBe(100); // 1h × intensity 1.0
    const half = computeHeatBurden(30, 100);
    expect(half).toBe(50);
    const mildExposure = computeHeatBurden(30, 20);
    expect(mildExposure).toBeLessThan(half);
  });

  it('picks heat tier from (default) apparent temperature', () => {
    expect(heatWeightFor(HOT_WEATHER)).toBe(0.5);
    expect(heatWeightFor({ ...MILD_WEATHER, apparentTemperatureC: 22 })).toBe(0.2);
    expect(heatWeightFor({ ...HOT_WEATHER, apparentTemperatureC: 28 })).toBe(0.35);
    expect(heatWeightFor(HOT_WEATHER, 24)).toBe(0.2);
  });
});