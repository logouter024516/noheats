/**
 * HeatPizza decision policy.
 *
 * The relative importance of heat rises with temperature. In cool weather the
 * recommendation is dominated by travel time; in very hot weather heat exposure
 * matters more. Weights always sum to 1 (transfer keeps a fixed share).
 */
export const HEAT_WEIGHT_TIERS = [
  { maxApparentC: 26, heatWeight: 0.2, tierName: 'cool' },
  { maxApparentC: 32, heatWeight: 0.35, tierName: 'hot' },
  { maxApparentC: Infinity, heatWeight: 0.5, tierName: 'veryHot' },
] as const;

export const TRANSFER_WEIGHT = 0.1;

/** Baseline weights for a cool day (documented for reference). */
export const POLICY_WEIGHTS = {
  duration: 0.7,
  heatBurden: 0.2,
  transfers: TRANSFER_WEIGHT,
} as const;

export const TEMPERATURE_CLAMP = { min: 15, max: 42 } as const;
export const UV_CLAMP = { max: 11 } as const;

/** heatIntensity (0–100) component weights; sum to 0.95, remainder is relief/penalty. */
export const HEAT_INTENSITY_WEIGHTS = {
  temperature: 0.55,
  humidity: 0.3,
  uv: 0.1,
} as const;

export const WIND_RELIEF_THRESHOLD_MPS = 3.0;
export const WIND_RELIEF = 0.05;
export const PRECIPITATION_PENALTY_MAX = 0.15;

/**
 * heatBurden = outdoorHours × weightedIntensity(0.25..1.0), normalized
 * against BURDEN_REFERENCE_HOURS so a full-hour heavy outdoor trip lands near 100.
 */
export const BURDEN_INTENSITY_MIN = 0.25;
export const BURDEN_INTENSITY_MAX = 1.0;
export const BURDEN_REFERENCE_HOURS = 1.0;

export const DURATION_NORMALIZATION = { min: 0, max: 120 } as const;
export const TRANSFER_NORMALIZATION = { min: 0, max: 3 } as const;

export type PolicyWeights = typeof POLICY_WEIGHTS;
export type HeatWeightTier = (typeof HEAT_WEIGHT_TIERS)[number];