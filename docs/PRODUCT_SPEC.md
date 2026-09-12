# HeatPizza P0 product specification

## One-line definition

**HeatPizza incorporates the environmental cost of heat into mobility decisions.** It compares travel choices so a user can decide what to take, when to leave, and how to get there—not merely see that it is hot.

## Target decision

Given origin, destination, and requested arrival time, recommend the best available route/mode and, where useful, a different departure time. P0 compares walking and transit at minimum against the shortest-time baseline.

### Required P0 journey

1. User enters origin, destination, and desired arrival time; current location may prefill origin after permission.
2. The app concurrently obtains route/transit and weather data, then derives outdoor/waiting exposure.
3. It shows a map plus a clear primary recommendation.
4. It explains the recommendation in human terms, shows alternatives, and compares it with the fastest/shortest-time option.
5. The user can change departure/arrival timing and recompute the same decision.

### Minimum result content

- Recommended mode/route and departure time
- Travel time, expected waiting time where available, outdoor walking time, and estimated heat score
- One concise reason tied to the data (for example, reduced outdoor exposure during high heat)
- At least one alternative, including the shortest-time baseline when different
- Data freshness, assumptions, and a transparent unavailable/fallback state

## Scope

| Tier | Include |
| --- | --- |
| P0 — 24-hour MVP | Web MVP, landing page, HTML presentation; origin/destination/arrival time; map; current location; live weather; live route/transit; walking + transit; Decision Engine; baseline comparison; departure-time recomputation; live/demo fallback. |
| P1 | Login, saved places/history/preferences, refinement of personalization, stronger observability and provider integrations. |
| P2 | Native polish, broader mode coverage, richer accessibility/localization, partnerships and production hardening. |
| Explicitly out of MVP | CFD/microclimate modelling, street-level shade claims, user sensor network, medical/personal health predictions, advanced ML, and a conventional long-running server. |

## Design principles

The design should feel decisive and calm, with the utility of a finance-quality decision flow—not a copy of Toss branding.

- Answer first; inputs and detail are secondary once a recommendation exists.
- One clear primary action per state.
- Use plain Korean and concrete trade-offs: “7분 더 걸리지만, 야외 노출은 약 12분 줄어요.”
- Reveal score inputs before deeper methodology; keep the map contextual rather than dominant.
- Make uncertainty visible without making the interface anxious.
- Ensure text, color contrast, touch targets, keyboard access, and screen-reader labels are treated as P0 quality.

## Success evidence

The workshop demo succeeds when a viewer can complete a live or clearly labelled fallback scenario; see why HeatPizza differs from the fastest option; change time and see a recomputed result; and understand the claim without trusting a black box. Capture fixed scenarios showing when HeatPizza agrees with and diverges from the shortest-time baseline.
