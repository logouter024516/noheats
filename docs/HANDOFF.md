# Handoff: first programming agent

## Current state

- Project root: `C:\Users\phjhy\OneDrive\Desktop\01_IPCEO\01_prj\00_NoHeatsMore`
- `apps/app` is the HeatPizza MVP client: Expo 57 / Expo Router starter with a **real-data, real-map decision flow**.
- Real adapters: Open-Meteo weather, Kakao Local place search + reverse geocode (+ Nominatim fallback), `routing.openstreetmap.de/routed-foot` walking, 서울시 대중교통환승경로 transit + Kakao Navi car directions (both via `apps/proxy/transit-server.mjs`). Car directions run live on the existing `KAKAO_REST_KEY`; Seoul transit runs live on `TRANSIT_API_KEY` (data.go.kr serviceKey, configured).
- Map: Leaflet + OpenStreetMap tiles embedded in the Expo web export (react-native-maps failed on web with a `codegenNativeComponent` error and was replaced).
- Deterministic labeled demo fallback: transit only (coordinate-matched fixtures for 을지로입구→강남역/명동입구/서울역, `데모 (대중교통 API 키 미설정)`).
- `dataStatus`: `idle | live | partial | demo`. `partial` = live weather+walk, demo transit (label + disclosure shown).
- Domain engine (`src/domain/{types,policy,engine,fixtures}`) preserved; fixtures now only feed the transit fallback.
- There is an independent Git repository inside `apps/app`; do not assume the root is tracked.

## Recommended build order

1. Read `AGENTS.md`, `PRODUCT_SPEC.md`, and `ARCHITECTURE.md`; inspect the Expo starter without resetting it.
2. Create a small domain layer for the normalized contracts, Decision Engine policy, fixtures, and unit tests. Lock the fastest-baseline comparison before UI polish.
3. Build the responsive decision flow with fixture/demo data first: input → loading → recommendation, comparison, alternatives, and time change.
4. Add provider adapters and narrow serverless proxies after choosing credentials/providers; retain the deterministic fallback.
5. Add map rendering and current-location convenience, gracefully handling denial/unavailability.
6. Build the landing page and static HTML presentation from the exact implemented flow, assumptions, and comparison evidence.
7. Validate the P0 checklist in `AGENTS.md`, then document provider choices and known limitations.

## Demo fallback contract

Prepare at least two deterministic scenarios:

- **Heat-aware divergence:** fastest walk is shorter, while transit has materially lower outdoor heat burden and becomes recommended.
- **Baseline agreement:** walking or the fastest mode stays recommended, demonstrating the engine is not biased toward transit.

Expose a discrete `데모 데이터` state/badge and preserve data-source/freshness text. A fallback must be instant, stable, and capable of supporting the full story when provider calls, geolocation, or network fail.

## Open decisions requiring owner/agent confirmation

- Map/directions/transit/weather providers and their available keys, coverage, attribution, and serverless deployment target. Current defaults chosen: Leaflet/OSM (keyless), Open-Meteo (keyless), OSM Nominatim + routed-foot (keyless), ODsay transit (needs key).
- The presentation's exact hosting URL and whether it lives in the Expo static output or a separate static folder.
- Initial scoring weights after reviewing real candidate-route data. Keep the proposed defaults until a documented change is approved.

## Provider choices and known limitations (rev 2, real-data flow)

Chosen providers (all verified live this revision):

- **Weather:** `api.open-meteo.com/v1/forecast` — keyless, CORS `*`, `current=...` fields, timezone Asia/Seoul, wind km/h→m/s conversion. Live-verified (temp 19.4–19.5, apparent 20.6, hum 74, precip 0, wind 3.1).
- **Geocoding:** `nominatim.openstreetmap.org/search` — keyless, `format=jsonv2&limit=5&accept-language=ko`. Verify it resolves Korean station names (강남역 37.5002,127.0268 · 서울역 37.5548,126.9722 · 을지로입구 37.5659,126.9826 · 잠실역 37.5127,127.0973 · 명동 37.5613,126.9851). OSM usage policy applies (~1 req/s).
- **Walking:** `routing.openstreetmap.de/routed-foot/route/v1/driving/...` — keyless, CORS `*`, real foot routing + elevation/profile. OSRM public demo (`router.project-osrm.org`) returned car-speed results (715s for 9.4 km) and was rejected.
- **Transit:** ODsay `searchPubTransPathT` behind `apps/proxy/transit-server.mjs` (`TRANSIT_API_KEY`, port 3001). Key not configured → proxy 404s → client surfaces explicit transit note and recommends from live walk-only sources (rev 4). Labeled demo fixtures are test-only (rev 4).
- **Map:** Leaflet 1.9 + OSM `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (remember attribution + `.openstreetmap.org` tile policy).

Known limitations / follow-ups:

1. **Transit needs a key.** Without `TRANSIT_API_KEY`, the recommendation is decided from real weather+walk only; the client shows an explicit note and no transit alternatives (rev 4 change; labeled demo fixtures removed from runtime).
2. **`React error #419`** ("Suspense boundary failed during server rendering, switched to client rendering") surfaces as a console `pageerror` on the static export load. It is recoverable: map, geocoding, search, and full result render and work in the production build. Likely a static-export hydration artifact (consumer-side); further root-cause if dev-mode SSR (`expo start --web`) is required. Note: two concurrent `expo start` on :8081 caused an `EADDRINUSE` 500 — not an app bug.
3. **CTA is disabled** until a valid place is selected for both fields (`index.tsx`), so the missing-input error card is mostly unreachable via the button; the error card survives for route-not-found / network failures.
4. **Leaflet was chosen over react-native-maps** because the native-map wrapper's web bundle throws `codegenNativeComponent is not a function`; native map support is deferred (P0 target is web at mobile width).
5. **Serverless proxy is a plain Node process** on :3001 for local demo. Before any real deployment, move it to the chosen serverless target and keep `TRANSIT_API_KEY` out of the client bundle.

Manual verification (P0 checklist) — desktop 1440×900 and mobile 390×844 against `serve dist`:

- Full flow 을지로입구→강남역: real weather (Open-Meteo), real walk (routed-foot), transit via :3001 → recommendation + baseline + alternatives + departure shift + reset all render; disclosure line shown for partial data.
- Real API calls observed: `api.open-meteo.com`, `routing.openstreetmap.de/routed-foot`, `localhost:3001/api/transit`, `nominatim.openstreetmap.org`.
- Unavailable/error handling: CTA disabled for missing input; `경로를 찾을 수 없습니다…` error card on no-routes; labeled `데모` fallback when transit key missing.
- `npx tsc --noEmit` clean; `npx jest` 19 passing; `npx expo export --platform web` succeeds.

## Handoff: Korea optimization (rev 4)

Incremental updates on top of rev 3.

### What changed this revision

- **Live-only runtime (directive: "DO NOT USE DATASET — USE REAL DATA BASED ON API!!!")**
  - `src/adapters/transit.ts`: removed `DEMO_SCENARIOS`/fixtures fallback; proxy failure or key-missing (404) surfaces an explicit Korean error/note — `대중교통 실시간 API 키가 설정되지 않았습니다...` — and the app recommends from the still-live weather + walking sources. No fabricated routes ever.
  - `src/hooks/useHeatPizza.ts`: new `AppState.transitNote` (carries the reason); `DataStatus` no longer has a `'demo'` state (default `partial`; `live` only when weather+walk+transit all succeed); `transitNote` is cleared on reset/input change.
  - `src/domain/fixtures.ts` + `src/korea/scenarios.ts` are strictly **test-only** inputs. Nothing in the runtime app imports them.
- **SearchInput dropdown rewrite** (start-location UI bug): suggestion rows were absolutely positioned, and RNW's stacked rows let the destination input and the `지금/+1시간` chips paint over and intercept the start-location list (verified via `elementFromPoint`). Converted to **in-flow layout** — rows push content down, zero overlap, clicks land. `onSubmitEditing` selects the top result as the deterministic keyboard path used by browser verification.
- **Proxy .env support** (`apps/proxy/transit-server.mjs`): now auto-loads an optional `apps/proxy/.env` (`TRANSIT_API_KEY=` or `KEY=`) in addition to environment variables. Proxy test suite bumped to 5 tests (added .env loader coverage).

### Test status (rev 4)

- App: `npx tsc --noEmit` clean · `npx jest` 8 suites **50 tests green**.
- Proxy: `node --test` **5 green**.

### Browser acceptance (rev 4)

Both flows pass on the live-only build (no `TRANSIT_API_KEY`):

- Seoul desktop 1440×900: 을지로입구→강남역 → decision `걸어가세요`, disclosure badge (`부분 데이터`), timings line, transit-note (`대중교통 실시간 API 키가 설정되지 않았습니다...`) shown.
- Busan mobile 390×844: 부산역→서면역 → same structure.
- Screenshots: `%TEMP%\opencode\hp-check\korea-desktop.png`, `korea-mobile.png`.

### Known limitations (rev 4)

1. With no `TRANSIT_API_KEY`, all recommendations are walk-only (real OSRM + Open-Meteo). The heat-aware transit-vs-walk divergence requires a live ODsay key to demonstrate.
2. Live ODsay E2E (real key) remains unit-test-only verified for the normalizer.
3. React #419 and the Open-Meteo usage policy notes from rev 3 remain valid.
4. The `SearchInput` keyboard selection picks the top Nominatim result; this matches the first hit for exact station names but may differ from a manual dropdown pick for ambiguous queries.

## Handoff: Korea optimization (rev 5)

Incremental updates on top of rev 4. This revision adds **Kakao** as the Korea-first provider path (place search + map) while keeping every provider optional and degradable.

### What changed this revision

- **Kakao Local place search via proxy** (`apps/proxy/transit-server.mjs` + new `apps/proxy/normalize-kakao-place.mjs`):
  - New `GET /api/places?q=<query>` → Kakao `v2/local/search/keyword.json` (size 5), normalized to the domain `Place` shape (`{label, subLabel, coordinate, source:'kakao'}`). Requires `KAKAO_REST_KEY` (server-side only).
  - Proxy reads optional `apps/proxy/.env` — documented in `.env.example` (`KAKAO_REST_KEY=`). Health now reports `kakaoKeyConfigured`.
  - No key → proxy returns 404 with a Korean-safe error, mirroring the transit pattern.
- **Client geocoding** (`src/adapters/geocoding.ts` + `src/korea/place.ts`): `searchPlaces` is now **Kakao-first with Nominatim fallback**. `normalizeKakaoPlace` (pure, mirrored in the proxy) accepts Kakao keyword docs, Korean-bbox filtered; any proxy failure or empty result degrades to the existing Nominatim path. No fabricated places.
- **Kakao Map JS SDK map** (`src/components/RealMap.tsx`): `RealMap` now renders a Kakao map when `EXPO_PUBLIC_KAKAO_MAP_JS_KEY` is set (client-visible JS key, defined in `apps/app/.env.local` via `.env.example`; domain must be allowlisted in the Kakao Developers console). Markers/popups (`InfoWindow`), route polylines (dash for walk), and the current-location circle are mirrored. If the SDK fails to load/init, it falls back to the existing Leaflet + OSM renderer. Without the key, the app behaves exactly as rev 4 (Leaflet + OSM).
- **`apps/app/.gitignore`**: added `.env` (`.env*.local` was already ignored; Expo auto-loads `.env.local`).

### Where keys live

| Key | File | Visibility |
|---|---|---|
| `KAKAO_REST_KEY` (Local API) | `apps/proxy/.env` (or env var) | server-side only |
| `EXPO_PUBLIC_KAKAO_MAP_JS_KEY` (Map JS SDK) | `apps/app/.env.local` | client-visible by design (JS key); inlined at export |
| `TRANSIT_API_KEY` (ODsay) | `apps/proxy/.env` (or env var) | server-side only |

### Test status (rev 5)

- App: `npx tsc --noEmit` clean · `npx jest` 8 suites **50 tests green** (place normalizer tests cover `normalizeKakaoPlace`).
- Proxy: `node --test` **9 green** (added `normalize-kakao-place.test.mjs`).
- Web export rebuilt; browser acceptance rev-4 flows re-verified green with real mouse clicks (Seoul desktop + Busan mobile, transit note + disclosure shown) — keyless state exercises the Kakao→Nominatim and Kakao→Leaflet fallbacks.
- **Live Kakao Local verified** (rest key = 32-char, kakaoMap ON): direct `v2/local/search/keyword.json` returns 200/5 docs for 강남역; `/api/places` normalizes to `source:'kakao'`; browser flow confirms the app resolves 강남역 via `localhost:3001/api/places` (Kakao, 200) and selects from those results. Nominatim is only hit as a fallback for sub-query searches where Kakao returns empty (e.g. one-character `강`).

### Known limitations (rev 5)

1. Kakao Local place search is **live and verified**; Nominatim remains the fallback for queries Kakao returns empty (short fragments) or proxy failure.
2. The Kakao **map** path stays untested live: no `EXPO_PUBLIC_KAKAO_MAP_JS_KEY` configured yet, so the Leaflet + OSM renderer is still active. To activate, add the JS key to `apps/app/.env.local` and allowlist the serving domain in the Kakao Developers console.
3. All rev-4 limitations persist: transit needs `TRANSIT_API_KEY` for live ODsay; live ODsay E2E still outstanding; React #419 note unchanged.

## Handoff: Korea optimization (rev 6)

Incremental updates on top of rev 5. This revision makes search results **merged Kakao keyword + address**, adds a **map-tap pin** with reverse geocoding, lands the **Kakao Map JS SDK live** (domain allowlist fix), and documents the outstanding transit key.

### What changed this revision

- **Search engine merge** (`apps/proxy/transit-server.mjs` + `apps/proxy/normalize-kakao-place.mjs`):
  - `GET /api/places` now runs Kakao **keyword** (`size 8`) and **address** (`size 6`) searches in parallel and merges them, `dedupePlacesByCoord` (round to 4 dp) keeping keyword hits first — live returns 8 for 강남역 and 11 for a road query.
  - New pure normalizers: `normalizeKakaoAddress` (address-search docs), `normalizeKakaoReverse` (coord2address docs), `dedupePlacesByCoord`. All covered by proxy tests.
  - Client `searchPlaces` no longer re-normalizes raw Kakao docs (the proxy already returns the domain `Place` shape); it validates shape, dedupes, caps at 8, and skips the Nominatim fallback for < 2 chars (one-Hangul queries returned noisy Nominatim streets).
- **Map pin** (`src/components/RealMap.tsx` + `src/app/index.tsx` + `src/adapters/geocoding.ts`):
  - `RealMap` gained `onMapClick(lat, lon)` — attached as a `click` listener in both the Kakao (via `kakao.maps.event`) and Leaflet renderers.
  - New proxy route `GET /api/reverse?lat&lon` → Kakao `v2/local/geo/coord2address.json` (road address preferred, admin fallback).
  - New client `reverseGeocode()`: proxy first, Nominatim reverse (`normalizeNominatimReverse`) as fallback; returns `Place | null`.
  - Tap behavior in `index.tsx`: fills the empty field first, replaces destination when both are set; label from reverse geocoding, else `지도에서 선택` + raw coords. No pin on adjustable points, no fabricated places.
- **Kakao map live**: `apps/app/.env` now carries `EXPO_PUBLIC_KAKAO_MAP_JS_KEY` (`x`-`.env` ignored, `.env.example` documents it). Map was verified **live** under headless Chrome (`window.kakao` present, no Leaflet fallback). Root cause of earlier blank map documented in rev-6 limitations — Kakao validates the `Referer` against registered web domains and serves a JSON error for mismatches (Chrome blocks that as `ERR_BLOCKED_BY_ORB`, so the SDK silently never loads). Fix was registering `http://127.0.0.1` (+ serving on `127.0.0.1:4173`, not `localhost`).

### Where keys live

| Key | File | Visibility |
|---|---|---|
| `KAKAO_REST_KEY` (Local API: keyword + address + coord2address) | `apps/proxy/.env` (or env var) | server-side only |
| `EXPO_PUBLIC_KAKAO_MAP_JS_KEY` (Map JS SDK) | `apps/app/.env` (or env var) | client-visible by design (JS key); inlined at export |
| `TRANSIT_API_KEY` (ODsay) | `apps/proxy/.env` (or env var) | server-side only |

### Test status (rev 6)

- App: `npx tsc --noEmit` clean · `npx jest` 8 suites **53 tests green** (new `normalizeNominatimReverse` cases).
- Proxy: `node --test test/normalize-kakao-place.test.mjs test/normalize-odsay.test.mjs` **14 green** (address + reverse + coord-dedupe cases).
- Web export rebuilt; browser acceptance re-verified with real mouse clicks — merged dropdown rows (강남역 2호선 · 신분당선 · POIs · address rows like 강남역사거리/역삼동), click-to-select fills the field, map tap drops a pin and reverse-geocodes to e.g. `서울 종로구 삼청동 25-1`. Kakao map renders live (`leaflet:false, kakao:true`).
- `verify-korea.mjs` re-run green (Seoul desktop + Busan mobile, 19 checks).

### Known limitations (rev 6)

1. **Transit is not live**: `TRANSIT_API_KEY` is still empty (`/health` → `keyConfigured:false`), so ODsay returns 404 and the app shows the `대중교통 실시간 API 키가 설정되지 않았습니다…` note, recommending from weather + walking only. Kakao's Local/Map keys do **not** cover transit directions — a separate ODsay key (already implemented) or a paid Kakao Mobility product is required. Once the key is set, live E2E verification is still outstanding.
2. Kakao pinned access to `http://127.0.0.1:4173`; `localhost:4173` referers get `domain mismatched!` so the map falls back to Leaflet there. The performance/search client hits the proxy via the page host, so both hosts work for search.
3. All rev-5 limitations persist except where superseded (map limitation removed; Nominatim is now only the <2-char / proxy-failure fallback).

## Handoff: Korea optimization (rev 7)

Incremental updates on top of rev 6. This revision switches transit to the **서울시 대중교통환승경로** open API (`ws.bus.go.kr` pathinfo) and lands a fully **live Kakao Navi car-directions** recommendation path (`자동차`) reusing the existing `KAKAO_REST_KEY` — no new key. Car is now the live demonstrated choice in browser acceptance.

### What changed this revision

- **Transit provider switch (ODsay → 서울시 대중교통환승경로)**
  - Decision record: TAGO rejected (no A→B route-planning API); 서울시 `getPathInfoByBusNSub` chosen (Seoul-only, WGS84, free auto-approved key, XML only, `time/distance` totals + per-leg `routeId/routeNm/fid/fname/fx/fy/tid/tname/tx/ty`).
  - `apps/proxy/normalize-seoul.mjs` (new, pure): parses a root-keyed XML doc (wrapper fix in `xml-simple.mjs` — it now returns the whole doc keyed by root element name; single occurrences = object, repeated siblings = array), wraps single-leg responses, emits the domain shape (`mode:'transit'`, segments with `startName/endName`, `source:'서울시 대중교통환승경로'`, `dataQuality:'live'`).
  - Documented Seoul semantics: provider returns no walking legs (walks = haversine × 1.3 @ 78 m/min), transit 8 m/s, provider total split by natural-time share then scaled and clamped ×0.5–3, `waitMin` 0 (absorbed into transit — the provider has none), `arrivalAt` echoes the client KST request.
  - `apps/proxy/transit-server.mjs`: `fetchSeoulTransit` (`startX/startY/endX/endY`, lon=X lat=Y); `/api/transit` now routes by `TRANSIT_PROVIDER` (`seoul` in `apps/proxy/.env`; ODsay code retained and dormant — flip to `odsay` to restore).
- **Car directions live (Kakao Navi, no new key)**
  - `apps/proxy/normalize-kakao-navi.mjs` (new, pure): `/v1/directions` (header `Authorization: KakaoAK ${KAKAO_REST_KEY}`, `origin/destination=lon,lat,name=`, `priority=RECOMMEND`) → `mode:'car'`, label `자동차`, single start→end segment, duration/distance from `summary`, polyline from `sections[].roads[].vertexes`.
  - New `GET /api/driving`; a key without the 길찾기 product returns a Korean 401/403 error; `/health` adds `drivingKeyConfigured`. **Verified live**: real route (자동차 25분, ~9 km, full polyline) with the existing `KAKAO_REST_KEY`.
- **Client car mode**
  - `src/providers/types.ts`: `DrivingRouteProvider`; `src/adapters/transit.ts` `transitProvider` renamed (label `proxy transit (ODsay/서울시)`); new `src/adapters/driving.ts` (`fetchDrivingRoutes`).
  - `src/domain/types.ts`: `RouteSegmentMode` + `'car'`; `RouteOption.mode` + `'car'`; `Timings.drivingMs`.
  - `src/hooks/useHeatPizza.ts`: driving fetched in parallel with weather/walk/transit; `SourceStatus.driving`; `liveCount===4` ⇒ `live`; timings gains `차량 Nms`. **Bug fixed:** `decisionEngineMs` was derived by subtracting parallel fetch wall-times and could go negative — now measured directly around `rank()`.
  - `src/utils/format.ts` (`차로 이동하세요`, `ModeGlyph` car, timings `차량`), `src/components/ResultCard.tsx` (car icon; partial badge copy clarifies `일부는 미리보기 데이터예요 (API 키 필요)`), `src/korea/scenarios.ts` `car()` + `s1-car` (서울역→강남역 22 min, test-only).
  - Heat model unchanged by design: a car segment is non-walk ⇒ indoor ⇒ `야외 0분`. No engine changes — car routes enter the same deterministic scoring.

### Where keys live

| Key | File | Visibility |
|---|---|---|
| `KAKAO_REST_KEY` (Local: keyword/address/reverse + **Navi directions**) | `apps/proxy/.env` (or env var) | server-side only |
| `EXPO_PUBLIC_KAKAO_MAP_JS_KEY` (Map JS SDK) | `apps/app/.env` (or env var) | client-visible by design (JS key) |
| `TRANSIT_API_KEY` (서울시 대중교통환승경로) | `apps/proxy/.env` (or env var) | server-side only |

### Test status (rev 7)
- App: `npx tsc --noEmit` clean · `npx jest` 9 suites **59 tests green** (rev-7 line + post-rev-7 dedupe suite).

- Proxy: `node --test "test/*.test.mjs"` **32 green** (xml-simple root-wrapper expectations; `normalize-seoul` fixture = 2 route itemLists with walk-producing coords; `normalize-kakao-navi`).

### Browser acceptance (rev 7)

- Browser acceptance: 을지로입구역 2호선 → 강남역 2호선 → 추천 받기 → **`차로 이동하세요`** (자동차 22분 this run, 야외 0분), **2 live transit alternatives** (버스 5005거용인→버스 420, 버스 9000성남→버스 140 — deduped from 4), 도보 137분. Tapping a transit row promotes it (`선택한 방법` chip, `버스를 타세요`, 환승 1회, segment chain); 추천 chip on 자동차 row; tapping it restores car. Console clean.
- Timings line positive: `날씨 1215ms · 도보 1384ms · 대중교통 1037ms · 차량 340ms · 판단 1ms · 전체 1385ms`.
- `verify-korea.mjs` re-run 19/19 (decisions `차로 이동하세요`). Screenshot `docs/screenshots/car-recommend-v2.png`.

### Known limitations (rev 7)

1. **Seoul transit live (post-rev-7 patch):** `TRANSIT_API_KEY` now holds a data.go.kr serviceKey (item 15000414); `/health` → `keyConfigured:true`, `/api/transit` returns live routes. Two integration gotchas found on the real API: (a) the query param is **`ServiceKey`** (capital S) and the key is **already percent-encoded**, so the URL is built by raw interpolation — `URLSearchParams` re-encodes `%` → `%25` and the upstream answers **401**; (b) the live payload uses repeated **`pathList`** legs and carries **`time` in minutes** (`normalize-seoul.mjs` previously read `pathInfoList` and treated `time` as seconds, so real routes normalized to `[]`). Proxy suite 34/34. Live E2E: 을지로입구역 2호선 → 강남역 2호선 → 자동차 24분 / 대안 버스 5005거용인→버스 420 34분 (야외 10분) + 3 more, 도보 137분; API-key note gone. ODsay remains as `TRANSIT_PROVIDER=odsay`.
2. Seoul pathinfo: no walking legs, no per-leg times, no departure-time param. Walk/wait/transit splits are documented estimates (constants in `normalize-seoul.mjs`). Non-Seoul queries fail the Seoul-only guard and surface the transit note.
3. Kakao Navi requires the Kakao Mobility **길찾기** product enabled on the REST key (working here). `priority=RECOMMEND` only — no alternatives or fares.
4. Car exposure is `야외 0분` by assumption (whole-trip indoor); destination parking/walking is not modeled in P0.
5. **My Location crash fixed (post-rev-7 patch):** `RealMap` anchored the `현재 위치` InfoWindow to a `kakao.maps.Circle` — the SDK's `InfoWindow.open(map, anchor)` only supports a Marker or a position, so the geolocation-success render threw (`TypeError: b.Xb is not a function`) and blanked the whole app. Fix: open the InfoWindow on the `LatLng` position instead, wrapped in try/catch (circle still renders). Verified in-browser with a geolocation stub: origin fills `현재 위치 · GPS (브라우저)`, map stays live, console clean; `verify-korea.mjs` 19/19.
6. **Map popup styling + location UX (post-rev-7 patch):** marker/current-location popups now render one shared card styled to the app system UI (radius 10, `#D9DDE3` border, `--font-display`, accent-label `출발/도착/현재 위치`); Kakao uses `InfoWindow customContent`, Leaflet uses `.hp-popup` chrome-stripping CSS in `src/global.css`. `Place.accuracy` (Geolocation API) drives an accuracy-aware blue circle (clamped 60–1500 m) and the map centers on the location. Single-point views center at a readable zoom instead of bounding. Screenshot `docs/screenshots/current-location-styled.png`.
7. **Transit dedupe + select-to-main alternative picker (post-rev-7 patch):** `src/domain/dedupe.ts` collapses near-duplicate transit options before ranking — exact ordered line-chain duplicates drop; routes sharing the same *tail* chain (legs after the first) within 2 min collapse to the first accepted. (The live 서울시 API returned the same bus/subway line up to 4× with only a different first leg.) `ResultCard` gained a `selectedRouteId` prop: tapping an alternative promotes it to the main card (**선택한 방법** chip) and moves the original recommendation into the list marked **추천**; divergence/baseline card shows only while the engine's recommendation is displayed. App suite 59/59 (6 new dedupe tests), `tsc` clean. Browser E2E: 을지로입구역 → 강남역 now shows 2 transit rows (was 4); tapping `버스 5005거용인→버스 420` → main card becomes `버스를 타세요 … 34분` and list shows 자동차[추천]/버스 9000성남→140/도보; tapping 추천 restores car. Console clean. Screenshot `docs/screenshots/alt-selected-main-v2.png`.
7. Rev-6 limitations persist: pinned to `http://127.0.0.1:4173` (Kakao referer), React #419 artifact, CTA-disabled, OSM tile policy.

## Handoff: Korea optimization (rev 3)

State after the Korea-first optimization slice. For the full phase report (decisions, formulas, sensitivity results, scenario coverage, evidence) read `docs/KOREA-OPTIMIZATION.md`.

### What changed

- **Domain model grew** (`src/domain/types.ts`): `Place.subLabel` + `source`; `DataQuality` (`live | estimated | demo`); `WeatherSnapshot.uvIndex` + `dataQuality`; `RouteSegment` (walk/bus/subway/train, `outdoor` flag); `RouteOption.segments` + `dataQuality`; `ExposureBreakdown`; `Recommendation.dataStatus` (`live | partial | demo`); `Timings`.
- **Korea-first helpers** (`src/korea/`):
  - `time.ts` — UTC+09:00 fixed, no DST; `toKstIso`/`kstParts`/`formatKoreanClock` (오전/오후), `sameKstDay`. **Bug fixed this phase:** `toKstIso` previously mislabeled UTC wall time as `+09:00`; it now shifts to KST wall time before stamping.
  - `place.ts` — Nominatim → Korean `Place` (Hangul-preferred labels, `subLabel` like "서울특별시 중구"/"경기도 고양시", non-Korea filtered, dedupe).
  - `heat.ts` — exposure breakdown (walking outdoor / waiting outdoor / sheltered waiting / indoor), heat intensity, heat burden, tiered heat weight. Bus waiting counts outdoor; subway waiting counts sheltered; transfer walks count outdoor.
  - `sensitivity.ts` — sweeps heat weight 0.20→0.60 and reports the crossover ("at what heat weight does walking stop being optimal?").
  - `scenarios.ts` — 10 reproducible Korea scenarios across 서울/부산/대전/대구/인천/광주/제주.
- **Engine** (`src/domain/engine.ts`) now consumes `korea/heat.ts`; scoring = duration weight + heat-burden weight (tier 0.2/0.35/0.5) + transfer weight (0.1), all normalized 0–1000 `decisionScore`. Fastest-baseline comparison preserved.
- **Provider abstractions** (`src/providers/types.ts`): `WeatherProvider` / `GeocodingProvider` / `WalkingRouteProvider` / `TransitProvider`. Adapters implement them; raw ODsay/Nominatim shapes never reach the engine.
- **Weather** (`src/adapters/weather.ts`): adds UV index, `dataQuality: 'live'`; failure → documented `추정 (실시간 날씨 로드 실패)` estimate (`dataQuality: 'estimated'`), UI shows UV + `실시간/추정/데모` tag.
- **Walking** (`src/adapters/walking.ts`): still OSRM foot; now emits a walk segment + `dataQuality: 'live'` and KST-correct `departureAt`.
- **Transit** (`src/adapters/transit.ts` + `apps/proxy/normalize-odsay.mjs`): proxy route normalization extracted into a dependency-free pure module with `node --test` coverage. `totalTime` now treated as **seconds** (was wrongly minutes); walk/wait/transfers derived from `trafficType` segments (1 subway, 2 bus, 6 train, 3/4 walk); wait = bottleneck remainder with documented 1/4-transit heuristic fallback; `trafficType 3` (transfer) classified walk ⇒ outdoor exposure.
- **Hook** (`src/hooks/useHeatPizza.ts`): `dataStatus: 'error'` when no paths; `sourceStatus` per provider; `Timings` instrumentation (weather/walking/transit/decisionEngine/total ms); weather fallback estimate.
- **Current location** (`src/hooks/useCurrentLocation.ts`): browser geolocation → origin `Place` (`현재 위치 · GPS (브라우저)`), denial → inline guidance, blue circle on the map.
- **UI polish** (no redesign): SearchInput shows `subLabel`; ResultCard adds UV + data tag, route segment chain (도보 7분 → 지하철 2호선 14분), timings line; arrival chips use `kstNow`/`shiftMinutes`.

### Test status (rev 3)

- App: `npx tsc --noEmit` clean · `npx jest` 7 suites **50 tests green** (engine, time, place, heat, sensitivity, scenarios, formatters).
- Proxy: `node --test` 4 green (ODsay normalization incl. transit-walk exposure, garbage payloads).

### Known limitations (additions since rev 2)

1. **Live ODsay end-to-end still unverified** — needs `TRANSIT_API_KEY`. Everything else (weather/geocoding/walk) is live-verified; without the key the client uses labeled demo transit.
2. **`totalTime` semantics** assumed seconds per ODsay docs; verify against a real payload when the key is available. Segment sum may exceed `totalTime` (parallel edges) — the wait remainder is clamped to ≥1 with the documented heuristic.
3. **Open-Meteo `current=` UV** is hourly-updated UV index; acceptable for decision purposes, documented in KOREA-OPTIMIZATION.md.
4. **Geolocation** only works in secure-context web (localhost/HTTPS); denial is a first-class path, not an error.
5. React #419, CTA-disabled behavior and the 8081 `EADDRINUSE` dev note from rev 2 remain valid.
