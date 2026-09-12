import {
  RouteOption,
  RouteSegment,
  WeatherSnapshot,
  ExposureBreakdown,
} from '../domain/types';
import {
  HEAT_WEIGHT_TIERS,
  TEMPERATURE_CLAMP,
  UV_CLAMP,
  HEAT_INTENSITY_WEIGHTS,
  WIND_RELIEF_THRESHOLD_MPS,
  WIND_RELIEF,
  PRECIPITATION_PENALTY_MAX,
  BURDEN_INTENSITY_MIN,
  BURDEN_INTENSITY_MAX,
  BURDEN_REFERENCE_HOURS,
} from '../domain/policy';

/**
 * Korea-aware heat exposure model.
 *
 * Only time genuinely spent outdoors counts as outdoor heat exposure:
 * walking (access / transfer / final), outdoor waiting, and exposed transfer
 * walking. Time inside vehicles and in stations is kept separate and is NOT
 * counted as equivalent exposure.
 *
 * When exact shelter information is unavailable (the default today), we apply
 * documented conservative assumptions and mark the result `estimated`:
 *  - waiting at a bus board counts fully outdoor;
 *  - waiting to board a subway counts as sheltered (underground station);
 *  - transfer walking is treated as outdoor walking.
 */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function firstBoardingMode(segments: RouteSegment[] | undefined): RouteSegment['mode'] | undefined {
  const boarding = segments?.find((s) => s.mode !== 'walk');
  return boarding?.mode;
}

/** Split waiting time between outdoor and sheltered using a conservative heuristic. */
function divideWaiting(
  route: RouteOption,
): { waitingOutdoorMin: number; waitingShelteredMin: number } {
  if (!route.segments || route.segments.length === 0) {
    // Conservative default: all waiting outdoors.
    return { waitingOutdoorMin: route.waitMin, waitingShelteredMin: 0 };
  }
  const boarding = firstBoardingMode(route.segments);
  if (boarding === 'subway' || boarding === 'train') {
    return { waitingOutdoorMin: 0, waitingShelteredMin: route.waitMin };
  }
  return { waitingOutdoorMin: route.waitMin, waitingShelteredMin: 0 };
}

/** Full outdoor/indoor breakdown for a route with documented estimated fields. */
export function computeExposureBreakdown(route: RouteOption): ExposureBreakdown {
  const segments = route.segments;

  if (route.mode === 'walk' || (segments && segments.every((s) => s.mode === 'walk'))) {
    return {
      walkingOutdoorMin: route.durationMin,
      waitingOutdoorMin: 0,
      waitingShelteredMin: 0,
      transferOutdoorMin: 0,
      indoorMin: 0,
    };
  }

  if (segments && segments.length > 0) {
    const walkingOutdoorMin = segments
      .filter((s) => s.mode === 'walk')
      .reduce((acc, s) => acc + s.durationMin, 0);
    const indoorMin = segments
      .filter((s) => s.mode !== 'walk')
      .reduce((acc, s) => acc + s.durationMin, 0);
    const { waitingOutdoorMin, waitingShelteredMin } = divideWaiting(route);
    // Transfer walking between vehicles is already inside the walk segments.
    return {
      walkingOutdoorMin,
      waitingOutdoorMin,
      waitingShelteredMin,
      transferOutdoorMin: 0,
      indoorMin: Math.max(0, indoorMin),
    };
  }

  // No segments: derive conservatively from aggregate fields.
  const { waitingOutdoorMin, waitingShelteredMin } = divideWaiting(route);
  return {
    walkingOutdoorMin: route.walkMin,
    waitingOutdoorMin,
    waitingShelteredMin,
    transferOutdoorMin: 0,
    indoorMin: Math.max(0, route.durationMin - route.walkMin - route.waitMin),
  };
}

/**
 * Total outdoor heat-exposure minutes.
 * outdoor = walkingOutdoor + waitingOutdoor + transferOutdoor (sheltered/indoor excluded).
 */
export function computeOutdoorExposureMinutes(route: RouteOption): number {
  const e = computeExposureBreakdown(route);
  return e.walkingOutdoorMin + e.waitingOutdoorMin + e.transferOutdoorMin;
}

/** heatIntensity 0–100 from weather, weighted toward apparent temperature. */
export function computeHeatIntensity(weather: WeatherSnapshot): number {
  const tempBase = weather.apparentTemperatureC ?? weather.temperatureC;
  const tempNorm = clamp(
    (tempBase - TEMPERATURE_CLAMP.min) / (TEMPERATURE_CLAMP.max - TEMPERATURE_CLAMP.min),
    0,
    1,
  );
  const humidityNorm = (weather.humidityPct ?? 50) / 100;
  const uvNorm =
    weather.uvIndex == null ? 0.5 : clamp(weather.uvIndex / UV_CLAMP.max, 0, 1);

  const raw =
    HEAT_INTENSITY_WEIGHTS.temperature * tempNorm +
    HEAT_INTENSITY_WEIGHTS.humidity * humidityNorm +
    HEAT_INTENSITY_WEIGHTS.uv * uvNorm -
    ((weather.windMps ?? 0) >= WIND_RELIEF_THRESHOLD_MPS ? WIND_RELIEF : 0) +
    (weather.precipitationProbability ?? 0) * 0.01 * PRECIPITATION_PENALTY_MAX;

  return Math.round(clamp(raw, 0, 1) * 100);
}

/**
 * heatBurden 0–100.
 * burden = outdoorHours × weightedIntensity(0.25..1.0) / referenceHour.
 * Documents how strongly outdoor minutes and heat intensity combine.
 */
export function computeHeatBurden(outdoorExposureMin: number, heatIntensity: number): number {
  const intensityFactor =
    BURDEN_INTENSITY_MIN +
    (BURDEN_INTENSITY_MAX - BURDEN_INTENSITY_MIN) * (heatIntensity / 100);
  const outdoorHours = outdoorExposureMin / 60;
  const raw = (outdoorHours * intensityFactor) / BURDEN_REFERENCE_HOURS;
  return Math.round(clamp(raw, 0, 1) * 100);
}

/** Heat share of the decision weight, scaled by temperature tier. */
export function heatWeightFor(weather: WeatherSnapshot, apparentOverride?: number): number {
  const temp = apparentOverride ?? weather.apparentTemperatureC ?? weather.temperatureC;
  const tier = HEAT_WEIGHT_TIERS.find((t) => temp < t.maxApparentC) ?? HEAT_WEIGHT_TIERS[HEAT_WEIGHT_TIERS.length - 1];
  return tier.heatWeight;
}