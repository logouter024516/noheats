import { RouteOption, WeatherSnapshot } from '../domain/types';
import { rank } from '../domain/engine';

export type SensitivityPoint = {
  heatWeight: number;
  recommendedId: string;
  recommendedMode: string;
  recommendedLabel: string;
};

export type SensitivityAnalysis = {
  points: SensitivityPoint[];
  /** First heat weight at which the recommendation differs from the cool-day baseline. */
  crossover: { heatWeight: number; fromId: string; toId: string } | null;
};

export const DEFAULT_SWEEP = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6] as const;

/**
 * Sweep the heat weight while keeping duration/transfer weights balanced and see
 * how the recommendation moves. Answers questions like
 * "at what heat weight does walking stop being the optimal choice?"
 */
export function sweepHeatWeight(
  routes: RouteOption[],
  weather: WeatherSnapshot,
  weights: number[] = [...DEFAULT_SWEEP],
): SensitivityAnalysis {
  if (routes.length === 0) {
    return { points: [], crossover: null };
  }

  const points: SensitivityPoint[] = weights.map((heatWeight) => {
    const rec = rank(routes, weather, { heatWeight }).recommended;
    return {
      heatWeight,
      recommendedId: rec.id,
      recommendedMode: rec.mode,
      recommendedLabel: rec.label,
    };
  });

  const baseline = points[0];
  const change = points.find((p) => p.recommendedId !== baseline.recommendedId);

  return {
    points,
    crossover: change
      ? { heatWeight: change.heatWeight, fromId: baseline.recommendedId, toId: change.recommendedId }
      : null,
  };
}

/**
 * Human summary of a sweep, e.g.
 * "도보 최적 → 열가중 0.35 이상에서 '지하철 2호선'으로 전환"
 */
export function describeSweep(analysis: SensitivityAnalysis): string {
  if (analysis.crossover) {
    const from = analysis.points[0].recommendedLabel;
    const to = analysis.points.find((p) => p.recommendedId === analysis.crossover!.toId);
    return `열 가중치 ${analysis.crossover.heatWeight.toFixed(2)} 이상에서 '${from}' → '${to?.recommendedLabel ?? analysis.crossover.toId}'로 추천이 바뀝니다.`;
  }
  return `열 가중치 범위 0.20–0.60에서 추천이 바뀌지 않습니다 (항상 '${analysis.points[0]?.recommendedLabel ?? '데이터 없음'}').`;
}