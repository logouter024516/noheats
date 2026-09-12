import { RouteOption, ScoredOption, WeatherSnapshot, Recommendation } from './types';
import {
  TRANSFER_WEIGHT,
  TRANSFER_NORMALIZATION,
  DURATION_NORMALIZATION,
} from './policy';
import {
  computeExposureBreakdown,
  computeHeatIntensity,
  computeHeatBurden,
  computeOutdoorExposureMinutes,
  heatWeightFor,
} from '../korea/heat';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

function generateReasons(route: ScoredOption): string[] {
  const reasons: string[] = [];

  const e = route.exposure;
  if (e && e.indoorMin > 0) {
    reasons.push(`실내 이동 ${e.indoorMin}분`);
  }

  if (route.outdoorExposureMin > 0) {
    reasons.push(`야외 노출 ${route.outdoorExposureMin}분`);
  }

  if (route.heatIntensity >= 60) {
    reasons.push('더위 강도 높음');
  } else if (route.heatIntensity >= 40) {
    reasons.push('더위 강도 중간');
  }

  if (route.waitMin > 5) {
    reasons.push(`대기 ${route.waitMin}분`);
  }

  if (route.heatBurden < 30) {
    reasons.push('더위 부담 낮음');
  } else if (route.heatBurden >= 60) {
    reasons.push('더위 부담 높음');
  }

  return reasons;
}

/**
 * Score a route. `heatWeightOverride` lets sensitivity analysis fix the heat
 * weight independent of the temperature tier; production uses the tier value.
 */
export function scoreRoute(
  route: RouteOption,
  weather: WeatherSnapshot,
  heatWeightOverride?: number,
): ScoredOption {
  const exposure = computeExposureBreakdown(route);
  const outdoorExposureMin = computeOutdoorExposureMinutes(route);
  const heatIntensity = computeHeatIntensity(weather);
  const heatBurden = computeHeatBurden(outdoorExposureMin, heatIntensity);

  const heatWeight = heatWeightOverride ?? heatWeightFor(weather);
  const durationWeight = clamp(1 - heatWeight - TRANSFER_WEIGHT, 0, 1);

  const normalizedDuration = normalize(
    route.durationMin,
    DURATION_NORMALIZATION.min,
    DURATION_NORMALIZATION.max,
  );
  const normalizedTransfers = normalize(
    route.transfers,
    TRANSFER_NORMALIZATION.min,
    TRANSFER_NORMALIZATION.max,
  );

  const decisionScore = Math.round(
    (durationWeight * normalizedDuration +
      heatWeight * (heatBurden / 100) +
      TRANSFER_WEIGHT * normalizedTransfers) *
      1000,
  );

  const scored: ScoredOption = {
    ...route,
    outdoorExposureMin,
    heatIntensity,
    heatBurden,
    decisionScore,
    reasons: [],
    exposure,
  };
  scored.reasons = generateReasons(scored);
  return scored;
}

export function rank(
  routes: RouteOption[],
  weather: WeatherSnapshot,
  options?: { heatWeight?: number; dataStatus?: Recommendation['dataStatus'] },
): Recommendation {
  if (routes.length === 0) {
    throw new Error('No route candidates provided for ranking');
  }

  const heatWeight = options?.heatWeight;
  const scored = routes.map((route) => scoreRoute(route, weather, heatWeight));
  scored.sort((a, b) => a.decisionScore - b.decisionScore);

  const recommended = scored[0];
  const fastest = [...routes].sort((a, b) => a.durationMin - b.durationMin)[0];
  const fastestScored = scored.find((s) => s.id === fastest.id)!;

  const alternatives = scored.filter((s) => s.id !== recommended.id);

  const tier = heatWeightFor(weather);
  const assumptions = [
    '야외 노출만 더위 부담으로 계산합니다. 실내·지하철 이동은 별도로 표시합니다.',
    '야외 노출 = 도보(실외) + 야외 대기 + 노출 환승 이동. 대기 분류는 보수적 가정(est.)을 사용합니다.',
    `더위 강도(0–100)는 체감 온도·습도·UV·바람·강수 확률을 반영합니다 (현재 티어: ${tier === 0.2 ? '서늘' : tier === 0.35 ? '더움' : '매우 더움'}).`,
    `가중치: 소요 시간 ${Math.round((1 - tier - TRANSFER_WEIGHT) * 100)}%, 더위 부담 ${Math.round(tier * 100)}%, 환승 ${Math.round(TRANSFER_WEIGHT * 100)}%.`,
    '이 점수는 열 노출 추정치이며 의학적 위험 예측이 아닙니다.',
  ];

  return {
    recommended,
    fastestBaseline: fastestScored,
    alternatives,
    assumptions,
    dataStatus: options?.dataStatus ?? 'demo',
  };
}