# Architecture, contracts, and Decision Engine

## Shape

Use the existing Expo Router app as the client. Deploy thin serverless proxy endpoints with the web deployment for any provider requiring secrets. Keep the Decision Engine in a shared, side-effect-free TypeScript module executed on the client.

```text
Expo web client
  ├─ location/input state and UI
  ├─ parallel adapters: weather, geocoding, route/transit
  └─ pure Decision Engine ──> recommendation view model
          ▲
serverless proxies (secrets, provider normalization, rate controls)
          ▲
weather / map / directions / transit providers
```

There is no traditional application server in P0. Proxies must be narrow: validate input, call the provider, return a normalized response, and avoid retaining location history by default.

## Provider strategy

Select Korean-capable map, directions/transit, and weather providers during implementation based on available credentials, terms, coverage, and web compatibility. Hide each behind an adapter; no provider-shaped object may enter scoring/UI directly. Read the provider's current official documentation before implementation.

Launch requests concurrently once coordinates and time are valid. Cancel stale searches, add a bounded timeout, and show individual source status. If live data fails, offer a clearly labelled deterministic demo scenario; never silently mix demo and live values.

## Normalized contracts

These interfaces are the intended boundary, not a demand for premature abstraction.

```ts
export type Coordinate = { latitude: number; longitude: number };
export type Place = { label: string; coordinate: Coordinate };

export type WeatherSnapshot = {
  observedAt: string;
  temperatureC: number;
  apparentTemperatureC?: number;
  humidityPct?: number;
  windMps?: number;
  precipitationProbability?: number;
  source: string;
};

export type RouteOption = {
  id: string;
  mode: 'walk' | 'transit';
  label: string;
  durationMin: number;
  walkMin: number;
  waitMin: number;
  transfers: number;
  geometry?: { latitude: number; longitude: number }[];
  departureAt: string;
  arrivalAt: string;
  source: string;
};

export type ScoredOption = RouteOption & {
  outdoorExposureMin: number;
  heatIntensity: number; // normalized 0–100
  heatBurden: number; // normalized 0–100
  decisionScore: number; // lower is better
  reasons: string[];
};

export type Recommendation = {
  recommended: ScoredOption;
  fastestBaseline: ScoredOption;
  alternatives: ScoredOption[];
  assumptions: string[];
  dataStatus: 'live' | 'partial' | 'demo';
};
```

## Decision Engine requirements

The engine accepts normalized options plus weather and policy parameters. It must return the same output for the same input, have no network/UI dependencies, and expose the component values used in every recommendation.

Suggested transparent policy for P0:

```text
outdoorExposureMin = walkMin + waitMin
heatIntensity = clamp(0..100, weighted(apparent temperature, humidity, weak wind, precipitation adjustment))
heatBurden = normalize(outdoorExposureMin × heatIntensity)
decisionScore = 0.55 × normalized(durationMin)
              + 0.35 × heatBurden
              + 0.10 × normalized(transfers)
```

These are initial, versioned assumptions—not scientific truth. Keep weights in one named policy object; document units, clamping, rounding, and missing-data defaults. If apparent temperature is unavailable, use ambient temperature and say so. Do not imply the score is a medical risk index.

Baseline is strictly the route with minimum `durationMin`, evaluated from the same candidate set. HeatPizza selects the minimum `decisionScore`. Departure-time exploration should evaluate a small bounded set of candidate times (including the requested time) with the same policy and return only material improvements.

## Security and privacy

- Use server-side environment variables for all secret provider keys and commit only `.env.example` with variable names.
- Validate/limit proxy parameters, set upstream timeouts, return only required fields, and avoid logging raw addresses or precise coordinates in production.
- Apply provider-required attribution and respect cache/rate/terms constraints.
- Treat browser geolocation as optional and request it only after user intent. No sign-in in P0; do not persist trip queries by default.

## Testing and validation

Unit-test normalization and Decision Engine edge cases: equal duration, missing apparent temperature, zero outdoor exposure, weather source failure, no transit option, and a case where the heat-aware winner differs from the fastest baseline. Add deterministic fixtures for both live-shaped and demo data. Manually validate responsive web, keyboard path, denied geolocation, slow API, partial API failure, and every demo narrative before presenting.
