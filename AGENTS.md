# HeatPizza agent guide

## Mission and product invariant

Build HeatPizza as a **heat-aware mobility decision service**, not a weather display. For an origin, destination, and desired arrival time, the product must compare viable options and answer in plain Korean: **“그래서 지금 어떻게 가면 되는데?”**

The recommender decides across three axes:

- **WHAT** — walking versus transit (P0 minimum).
- **WHEN** — leave now or at a changed departure time.
- **HOW** — the route/mode that best balances arrival and heat exposure.

The product claim must remain modest and inspectable. Present a recommendation as a decision based on route, forecast, and stated assumptions; never claim exact personal heat exposure, shade coverage, safety, or medical advice.

## Read before implementation

1. `README.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/HANDOFF.md`
5. `apps/app/AGENTS.md` before editing the Expo app.

Use the local `.agents/skills/heatpizza-development` skill context when the host supports project-local skills. Its source-of-truth documents are the `docs/` files above.

## Existing code and workspace conventions

- Work in `apps/app`; it is an Expo Router TypeScript starter on Expo SDK 57. Preserve the app's existing Expo-version constraint and consult the versioned Expo 57 documentation before using Expo-specific APIs.
- `apps/app` has its own Git repository. If Git work is requested, stay on `main`; do not create a branch and do not rewrite history.
- The outer folder has a minimal pnpm/Turbo scaffold but no configured workspaces. Do not restructure package management merely for tidiness. Prefer the app's existing dependency manager until the user requests consolidation.
- Do not delete starter code or run `reset-project` as setup. Replace or retire it only as part of an explicitly requested product implementation.

## Implementation guardrails

- Keep the Decision Engine deterministic, pure, local/client-side, and unit-testable. API adapters fetch/normalize data; UI renders returned view models; neither owns scoring policy.
- Put provider secrets only behind serverless proxy endpoints and server-side environment variables. Never put secret keys in the Expo bundle, `app.json`, source, screenshots, or logs.
- Start independent API requests in parallel, show useful progress quickly, and degrade feature-by-feature when a noncritical source fails.
- Preserve a first-class **shortest-time baseline** beside HeatPizza. The demo must make the difference between the two recommendations visible.
- Prefer explicit unknown/unavailable states over fabricated precision. Mock/demo data must be visibly labelled and isolated from live adapters.
- Do not build CFD, street-level microclimate simulation, crowdsourced sensors, personal health modelling, ML, auth, accounts, or a traditional always-on server in P0.

## UX bar

Use the *principles* of a Toss-like experience without borrowing brand assets, visual identity, copy, or implying affiliation: immediate answer first, one primary action, progressive disclosure, plain language, calm hierarchy, and legible trade-offs. A map supports the choice; it must not bury the choice.

The primary result must expose recommendation, arrival/departure consequence, heat/outdoor-exposure rationale, and alternatives. Score labels must be explainable; do not display a mysterious single number as the only evidence.

## Definition of done for a P0 slice

A slice is done only when it has loading, unavailable/error, and demo-fallback behavior; works on web at a practical mobile width; has deterministic logic covered by tests or documented manual cases; and does not expose secrets. Before handoff, record assumptions and known data-provider limitations.
