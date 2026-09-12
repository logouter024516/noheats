# HeatPizza — Korea Optimization (phase report)

**Status:** implemented and verified (unit + tsc + export + browser flows).
This document is the source of truth for the Korea-first optimization slice. It records
decisions, formulas, provider assumptions, and known limitations so downstream agents do
not re-litigate settled choices.

Product invariant (unchanged): answer plain Korean "그래서 지금 어떻게 가면 되는데?" by
comparing options on **WHAT (walk vs transit)**, **WHEN (leave now vs shifted)**, and
**HOW (route/mode balancing arrival and heat)**. Recommendation stays modest and
inspectable — never personal heat-exposure, safety, or medical advice.

---

## 1. Scope discipline

Middle layer done only because it serves the decision. No CFD / street microclimate
simulation, no crowdsourced sensors, no health modelling, no ML, no auth/accounts, no
always-on server, no social/ads/billing/localization beyond Korean. The proxy is a thin
key-hider, not a BFF.

## 2. Korea-first address & place normalization

- Source: Nominatim `format=jsonv2` with `accept-language=ko&extratags=1&addressdetails=1`
  (keyless; OSM usage policy ~1 req/s).
- `src/korea/place.ts` normalizes provider output before anything else sees it:
  - Korea bounds check (lat 33.05–38.70, lon 124.5–131.95).
  - Display label prefers Hangul names; recognizes subway/station types via extratags
    (`railway=station`, `station=subway_entrance`).
  - `subLabel` = Korean admin context: `서울특별시 중구`, `경기도 고양시`, `제주특별자치도`.
    Global components (`대한민국`, `South Korea`, postcode, country codes) are stripped.
  - Non-Korea and malformed results return `null` (filtered, never crash).
- Covered in `korea/__tests__/place.test.ts` with 서울/부산 metro cases + rejection paths.

## 3. Korean transit (ODsay primary)

- Proxy `apps/proxy/transit-server.mjs` hides `TRANSIT_API_KEY`; client never holds it.
- Normalization extracted to dependency-free `apps/proxy/normalize-odsay.mjs`
  (`node --test` green):
  - `info.totalTime` is **seconds** (was incorrectly read as minutes before this phase).
  - Segments from `subPath.trafficType`: 1 subway, 2 bus, 6 train, 3 = transfer walk,
    4 = walk. `trafficType 3` classifies as walk ⇒ **outdoor heat exposure**.
  - `walkMin` = sum of walk-type section times; `waitMin` = total − vehicle − walk
    remainder, clamped ≥1 (with a documented `vehicleSec/4` heuristic when the SVR derives 0).
  - `transfers` derived from consecutive vehicle-run count, not provider `pathType`.
  - Route label = up-to-2 vehicle labels joined `→` (e.g. `지하철 2호선`, `143 → 471`).
  - `arrivalAt` echoes the client's KST request; `departureAt` = arrival − duration, KST.
- No key configured → proxy 404 → client **labeled** demo fallback
  (`데모 (대중교통 API 키 미설정)`, `dataQuality: 'demo'`). Never silent.

## 4. Heat exposure — outdoor minutes only

`src/korea/heat.ts`:

| Segment type            | Exposure              |
| ----------------------- | --------------------- |
| walk (access/egress)    | outdoor walking       |
| transit-walk (type 3)   | outdoor transfer walk |
| bus waiting             | outdoor (conservative)|
| subway/train waiting    | sheltered (station)   |
| vehicle/subway time     | indoor (not exposed)  |

`outdoorExposureMin = walkingOutdoor + waitingOutdoor + transferOutdoor`.
Indoor/station time is NOT counted as exposure. When exact shelter metadata is absent,
documented conservative defaults apply and results are labelled `estimated` in assumption
copy (not in a per-field tag in this slice).

## 5. Heat intensity & burden (documented formulas)

`heatIntensity` 0–100 → weight apparent temperature (falls back to ambient), humidity, UV:

```
tempNorm  = clamp((apparent  − 15) / (42 − 15), 0, 1)
humidity  = humidityPct / 100
uvNorm    = uvIndex==null ? 0.5 : clamp(uvIndex / 11, 0, 1)
intensity = 0.55·tempNorm + 0.30·humidity + 0.10·uvNorm
          − windRelief(≤0.05 if wind ≥3 m/s) + 0.15·precipProb
burden    = clamp( (outdoorExposureMin/60) × (0.25 + 0.75·intensity) / 1.0h, 0, 1 )
```

`heatBurden` 0–100 = normalized product of exposure-hours × (0.25…1.0) intensity factor —
i.e., exposure and heat intensity multiply, as they should for a route decision.

## 6. Decision engine + sensitivity

- Deterministic, pure, local. `scoreRoute` = duration weight + heat weight + transfer weight
  (total 1). `decisionScore` 0–1000 (lower better), tie-free ordering.
- Heat tier from perceived temperature: `<26°` → **0.20**, `26–32°` → **0.35**, `≥32°` → **0.50**.
  Duration share = `1 − heatWeight − 0.10 (transfer)`.
- **Sensitivity analyzer** (`src/korea/sensitivity.ts`): sweeps `heatWeight 0.20→0.60` and
  reports the first crossover. Example answers: "열 가중치 0.25 이상에서 '도보' → '지하철 2호선'로
  추천이 바뀝니다." Unit-tested (Seoul walking crossover + stable-no-crossover cases).
- **Fastest-baseline preserved**: `fastestBaseline` always shown beside the recommendation;
  the demo makes the final-arrival/heat trade-off visible (min extra minutes, outdoor minutes
  saved).
- No mysterious single number: `decisionScore` internal, UI exposes reasons (실내 이동/야외
  노출/더위 강도/대기/더위 부담), segment chain, burden level label, weather line.

## 7. Asia/Seoul time handling

- Fixed UTC+09:00, no DST (`src/korea/time.ts`). All timestamps ISO with explicit `+09:00`.
- `kstNow` / `shiftMinutes` / `kstParts` / `formatKoreanClock` (오전/오후), `sameKstDay`.
- **Bug found + fixed this phase:** `toKstIso` stamped UTC wall time as `+09:00` (9h error);
  it now shifts to KST wall time before stamping. Verified by tests.

## 8. Weather provider abstraction

- `WeatherProvider` interface; present adapter = Open-Meteo. Same interface shape for a
  future KMA adapter (add `dataQuality: 'live'`, `source: 'KMA'`, same domain snapshot —
  no engine change needed).
- Failure → `ESTIMATED_WEATHER` (`dataQuality: 'estimated'`, labeled `추정 (실시간 날씨
  로드 실패)`, ambient≈apparent default 28°) so a single source breaking degrades, not dies.
- Weather line shows temp + mood + humidity + UV index + `실시간/추정/데모` tag.

## 9. Current location

- `useCurrentLocation`: `idle | locating | ready | denied | unavailable`; denial is a
  recoverable state with inline guidance (manual input still works). "현재 위치 · GPS
  (브라우저)" becomes origin; blue accuracy circle drawn on the map.

## 10. Walking realism assessment

- Kept `routing.openstreetmap.de/routed-foot` (rejected project-osrm for car-speed results,
  rev 2). It is road-network pedestrian routing, not sidewalk-level; it cannot model shade,
  pedestrian-only zones, steepness beyond OSRM profile, or tunnel/bridge heat.
- Marked in KOREA-OPTIMIZATION as `live` availability, conservative about fidelity; shade /
  microclimate granularity declared out of scope for P0.

## 11. dataStatus & honest disclosure

- `idle → live (3/3 live) / partial (≥1 live) / demo (all fallback) / error (no paths)`.
- Non-live states always render disclosure copy; `demo` transit carries its own `데모 (대중교통
  API 키 미설정)` badge; estimated weather is tagged `추정`.

## 12. Performance instrumentation

- `Timings` (ms): `weatherMs`, `walkingMs`, `transitMs`, `decisionEngineMs`, `totalMs`.
- Requests start in parallel (`Promise.allSettled`); results show progressively; timings
  rendered as a small right-aligned line so 2 s target is measurable in the browser.
- Baseline observed (real cold paths, rev 2): decision engine is pure sync (µs); total is
  dominated by network. No caching added in P0.

## 13. Korean UX copy (examples)

| Slot                     | Copy                                              |
| ------------------------ | ------------------------------------------------- |
| Verb                     | 걸어가세요 / 지하철을 타세요 / 버스를 타세요 / 차로 이동하세요 (rev 7) |
| Reason                   | `${n}분 더 걸리지만, 야외 노출을 ${m}분 줄여 …`    |
| Departure shift          | `-10분 / 지금 / +10분`                             |
| Weather tag              | `실시간 · 추정 · 데모`                             |
| Disclosure               | `날씨·도보는 실시간, 대중교통은 미리보기 데이터…`   |
| Geolocation denied       | `위치 권한이 거부됐어요. 아래 칸에 … 직접 입력…`     |
| Loading                  | `경로를 비교하고 있어요...`                        |
| Error                    | `경로를 찾을 수 없습니다. 출발지와 도착지를 확인…`  |

Consistent informal-polite ending (요). No jargon, no English mixed in primary copy.

## 14. Map & cartography

- Default: Leaflet + OSM tiles (keyless, attribution kept, tile policy respected). Route polylines
  color/weight encode recommended vs alternative vs selected; walk routes dashed. Popups in
  Korean. Native maps deferred (react-native-maps web `codegenNativeComponent` failure, rev 2).
- When `EXPO_PUBLIC_KAKAO_MAP_JS_KEY` is set (rev 5, live rev 6): the Kakao Map JS SDK renders
  instead — same polylines/dash/popups semantics, current-location circle — and any SDK load/init
  failure falls back to Leaflet. The key is client-visible by design (JS key) and the serving
  domain must be allowlisted in the Kakao Developers console.

**Verified behavior (rev 6):** `window.kakao` present under headless Chrome, no Leaflet fallback.
Kakao rejects requests whose `Referer` is not an allowlisted web domain and serves a JSON error
instead of the SDK; Chrome then blocks that error payload as `ERR_BLOCKED_BY_ORB`, so the SDK
"never loads" with a clean console. Resolution: allowlist `http://127.0.0.1` and serve on
`127.0.0.1:4173` (NOT `localhost`, whose referer is still rejected and falls back to Leaflet).

Map tap → pin: both renderers attach a `click` listener (`kakao.maps.event` / Leaflet `click`).
The app reverse-geocodes the point and fills the empty origin/destination field (replaces
destination when both are set); if reverse geocoding fails it pins `지도에서 선택·좌표`.

Marker/current-location popups (post-rev-7): both renderers show one shared popup card that
mirrors the app system UI — white, `#D9DDE3` border, radius 10, `var(--font-display)` stack,
accent-blue 10px kind label (출발/도착/현재 위치), 13px label, compact padding, soft shadow.
Kakao uses `InfoWindow({ customContent:true })`; Leaflet uses a `.hp-popup` class that strips
Leaflet's own popup chrome (`src/global.css`). Marker/label HTML is escaped (no provider string
is ever injected raw). Current location: accuracy-aware blue circle (`Place.accuracy` from the
Geolocation API, clamped 60–1500 m) + `<현재 위치>` card; the map centers via
`map.setCenter`/`map.panTo`. A single origin/destination point now centers at a readable zoom
instead of guessing bounds (Kakao `setLevel(5)`, Leaflet `setView(…,15)`).

## 15. Providers & boundaries

| Capability | Provider        | In client | Key        |
| ---------- | --------------- | --------- | ---------- |
| Weather    | Open-Meteo      | yes       | none       |
| Place search | Kakao Local (keyword + address, merged) → Nominatim fallback (< 2 chars or proxy failure) | no (proxy primary) | `KAKAO_REST_KEY` server-side; Nominatim keyless (usage policy applies) |
| Reverse geocode | Kakao Local coord2address → Nominatim fallback | no (proxy primary) | `KAKAO_REST_KEY` server-side |
| Walking    | OSRM routed-foot| yes       | none       |
| Transit    | 서울시 대중교통환승경로 (`ws.bus.go.kr/api/rest/pathinfo/getPathInfoByBusNSub`, Seoul-only) — ODsay dormant behind `TRANSIT_PROVIDER=odsay` | no (proxy)| `TRANSIT_API_KEY` (data.go.kr item 15000414) server-side |
| Driving    | Kakao Navi `/v1/directions` (RECOMMEND) | no (proxy)| reuses `KAKAO_REST_KEY` (길찾기 product) server-side |
| Map        | Kakao Map JS SDK (set) / Leaflet + OSM | yes | `EXPO_PUBLIC_KAKAO_MAP_JS_KEY` client-visible; none |

Provider-specific shapes never cross into the decision engine; only domain types do.

## 16. Tests

- App (`npx jest`, 8 suites / 53 tests): engine, korea/time, korea/place (incl. Kakao
  normalization and Nominatim reverse), korea/heat, korea/sensitivity, korea/scenarios,
  formatters. Unicode/Korean text asserted throughout.
- Proxy (`node --test test/*.test.mjs`, 32 tests): ODsay normalization incl. transfer-walk
  exposure, seconds semantics, garbage payloads; Kakao keyword + address + coord2reverse
  normalization, Korea bbox, coord-dedupe; `xml-simple` root-keyed wrapper expectations;
  `normalize-seoul` (2 route itemLists, walk-producing coords, single-leg wrap);
  `normalize-kakao-navi` (car mode, polyline vertex extraction).
- `npx tsc --noEmit` clean.

## 17. Browser acceptance

Verified against the static export (`serve dist`, `expo export --platform web`):

- Seoul: 을지로입구→강남역 full flow (real weather + real walk + transit via proxy or labeled
  demo) — desktop 1440×900 and mobile 390×844.
- Non-Seoul city: 부산 (부산역) geocoding path resolves and renders; (result in rev 3
  verification run — see evidence section below).
- Real API calls observed: open-meteo, routed-foot, nominatim, localhost:3001.
- Rev 6 additions: merged dropdown rows (station POIs + address seeded rows), click-to-select
  fills the field, map tap drops a pin reverse-geocoded to a road address (e.g.
  `서울 종로구 삼청동 25-1`). Kakao map live (`leaflet:false, kakao:true`).

## 18. Known limitations (decide later)

1. Live ODsay response (with a real key) unverified — normalize-odsay unit-tested only.
2. Open-Meteo UV is the public API's current UV (`uv_index`); KMA would be finer-grained but
   needs a server-side key — documented trade, no code change needed thanks to the provider
   interface.
3. Waiting-time split (outdoor vs sheltered) uses documented conservative heuristics when
   segments lack shelter metadata.
4. Geocoding usage policy limits interactive demos to low QPS; no caching in P0.
5. Walking fidelity remains network-grade (see §10).

## 20. Live-only runtime (rev 4)

Directive: **"DO NOT USE DATASET — USE REAL DATA BASED ON API!!!"** The runtime never
consumes demo/scenario datasets anymore.

- `src/adapters/transit.ts`: removed the `DEMO_SCENARIOS`/fixtures fallback. If the ODsay
  proxy is unreachable, returns an error; if the proxy reports key-missing (404
  `key/API/not configured`), the client surfaces an explicit note —
  `대중교통 실시간 API 키가 설정되지 않았습니다...` — and recommends from the still-live
  weather + walking sources. No fabricated routes under any conditions.
- `src/hooks/useHeatPizza.ts`: `AppState.transitNote` carries the reason; `DataStatus` has no
  `'demo'` state (default is `partial`, `live` only when weather+walk+transit all succeed).
- `src/domain/fixtures.ts` + `src/korea/scenarios.ts` are **test-only** inputs (engine
  determinism/sensitivity tests). Nothing in the app bundle imports them at runtime.
- Proxy reads an optional `apps/proxy/.env` (`TRANSIT_API_KEY=` / `KEY=`) plus env vars;
  still never bundled in the client. Without a key the app is honest: real walk-only
  recommendation + transit note.
- SearchInput: suggestion list is now **in-flow layout** (plain rows, no absolutely-positioned dropdown). Empirical RNW behavior: z-index did not survive the FlatList's per-row stacking contexts, so an open origin dropdown was intersected by the destination input and the arrival chips and could not be clicked. The flow layout pushes subsequent content down — no overlap, deterministic mouse clicks — and `onSubmitEditing` selects the top result as a keyboard path. This is the selection method used by browser verification.

Browser acceptance re-verified with the live-only build (desktop Seoul + mobile Busan): all
steps pass, decisions `걸어가세요`, disclosure badge + timings + transit-note shown.
`npx tsc --noEmit` clean, `npx jest` 50/50 (8 suites), proxy `node --test` 5/5.

## 21. Seoul transit key — resolved

1. Seoul transit (`TRANSIT_API_KEY`, data.go.kr 15000414) is now configured and live
   (`/health` → `provider:"seoul","keyConfigured":true`). Every `내게 맞는 추천` now ranks
   live weather + walk + car + real Seoul transit routes; the API-key note is gone.
2. Two real-API gotchas fixed during integration (unit fixtures had not caught them):
   - Query param is **`ServiceKey`** (capital S), and the data.go.kr serviceKey is
     **already percent-encoded**. Build the URL by raw interpolation; `URLSearchParams`
     re-encodes `%` → `%25` and the upstream replies **401**.
   - The live payload emits repeated **`pathList`** legs (f/fx/fy → t/tx/ty) and carries
     **`time` in minutes**, not `pathInfoList`/seconds. `normalize-seoul.mjs` now reads the
     live shape (legacy `pathInfoList` fixture shape still accepted) and treats `time` as
     minutes. Proxy suite 34/34; `verify-korea.mjs` 19/19.

## 22. Korea optimization (rev 7): 서울시 transit + Kakao Navi car

Supersedes §3/§5-rev6 expectations for transit and adds a live third recommendation mode.

### Transit — 서울시 대중교통환승경로 (`ws.bus.go.kr` pathinfo)

- Endpoint `GET .../getPathInfoByBusNSub?ServiceKey&startX&startY&endX&endY` (Seoul-only,
  WGS84, X=lon Y=lat, XML). No departure-time param (provider is schedule-free); `arrivalAt`
  echoes the client KST request. `ServiceKey` must be sent raw (already percent-encoded).
- `apps/proxy/normalize-seoul.mjs` (pure, dependency-free) emits the same domain shape as
  ODsay. `xml-simple.mjs` now returns the whole doc keyed by the root element name (no
  single-root unwrap): single occurrence = object, repeated siblings = array. Single-leg
  responses are wrapped explicitly.
- Documented Seoul semantics (engineering constants, labeled `estimated` in assumptions):
  - Provider returns vehicle legs only (no walking). Access/egress/transfer walks =
    haversine × 1.3 @ 78 m/min; transit 8 m/s; both outer clamped 0.5–3× provider total.
  - Provider total is split across legs by natural-time share; `waitMin` = 0 (absorbed —
    the provider has none).
- `TRANSIT_PROVIDER=seoul` (default). ODsay code retained; flip to `odsay` to restore.

### Car — Kakao Navi `/v1/directions`

- Proxy `GET /api/driving` → `Authorization: KakaoAK ${KAKAO_REST_KEY}`,
  `origin/destination=lon,lat,name`, `priority=RECOMMEND`, `alternatives=false`,
  `road_details=false`. Korean 401/403 error surfaced when the 길찾기 product is not enabled.
- `apps/proxy/normalize-kakao-navi.mjs` (pure): `mode:'car'`, label `자동차`, one start→end
  segment, duration/distance from `summary`, polyline from `sections[].roads[].vertexes`
  (flat `[lon,lat,…]`).
- **Live-verified** (`drivingKeyConfigured:true`): 자동차 25분 / ~9 km / full polyline.
- Client (`src/adapters/driving.ts`, `Timings.drivingMs`, `SourceStatus.driving`): fetched in
  parallel with weather/walk/transit; `liveCount===4` ⇒ `live`. `decisionEngineMs` measured
  directly around `rank()` (was derived from parallel fetch wall-times and could be negative).
- Heat model: car segment is non-walk ⇒ indoor ⇒ `야외 0분` (assumption copy, not measurement).

### Browser acceptance (rev 7)

을지로입구역 2호선 → 강남역 2호선 → 추천 받기 → **`차로 이동하세요`** (자동차 24분, 야외 0분,
부담 낮음), live weather 24.6°/57%/UV 4.3, **live Seoul transit alternatives**
(버스 5005거용인 → 버스 420, 34분 / 야외 10분 + 3 more), walk alternative 137분,
Kakao map live. Timings all positive
(`날씨 1215ms · 도보 1384ms · 대중교통 1037ms · 차량 340ms · 판단 1ms · 전체 1385ms`).
`verify-korea.mjs` 19/19. Screenshot `docs/screenshots/car-recommend-v2.png`.

### Post-rev-7 patch: transit dedupe + select-to-main alternative picker

- `src/domain/dedupe.ts` (pure, provider-agnostic, applied client-side in `useHeatPizza.search`
  before `rank()`): exact ordered line-chain signatures drop; routes sharing the same *tail*
  chain (legs after the first) within `DEDUPE_TOLERANCE_MIN = 2` min collapse to the first
  accepted (stable). The live 서울시 API returned the same bus/subway up to 4× differing only in
  first leg — after dedupe the 을지로입구→강남역 demo shows 2 distinct transit rows.
- `ResultCard` accepts `selectedRouteId`: tapping an alternative promotes it to the main card
  (`선택한 방법` chip; verb/reason/stats/chain all follow the pick) and the engine recommendation
  appears in the list under a `추천` chip; the divergence/baseline card renders only while the
  engine's own recommendation is displayed. Map polyline already highlighted the pick.
- App suite 9 suites / 59 tests (6 new dedupe cases), `tsc` clean. Live E2E verified: tap
  `버스 5005거용인→버스 420` → main = `버스를 타세요` 34분 / 환승 1회; list =
  자동차[추천] / 버스 9000성남→버스 140 / 도보; tapping 추천 restores `차로 이동하세요`. Console
  clean. Screenshot `docs/screenshots/alt-selected-main-v2.png`.

### Rev-7 limitations

1. Seoul transit live (§21 records the integration gotchas) — Seoul-only; non-Seoul still
   falls back to the transit note. ODsay remains as `TRANSIT_PROVIDER=odsay`.
2. Seoul pathinfo: no walking legs / per-leg times / departure-time. Splits are estimates.
   Non-Seoul queries fail the Seoul-only guard.
3. Kakao Navi: 길찾기 product required; RECOMMEND only (no alternatives/fares).
4. Car `야외 0분` is an assumption (no destination parking/walk modeling in P0).
5. **My Location crash (fixed):** the Kakao renderer anchored the `현재 위치` InfoWindow to a
   `Circle`; `InfoWindow.open(map, anchor)` only accepts a Marker or a position, so once
   geolocation succeeded the SDK threw `b.Xb is not a function` and the whole app went blank.
   Fixed by opening the InfoWindow on the `LatLng` position (try/catch guarded; circle kept).
   Verified with a geolocation stub: origin fills `현재 위치 · GPS (브라우저)`, map live,
   console clean.
6. Rev-4/5/6 limitations that remain valid survive: pinned `127.0.0.1:4173` referer, React #419
   static-export artifact, CTA-disabled-until-valid, OSM tile policy, low-QPS geocoding.

## 19. Evidence (rev 3–4)

- `npx tsc --noEmit` — clean (re-verified rev 4).
- `npx jest` — 50/50 green (8 suites, re-verified rev 4).
- `node --test test/*.test.mjs` (proxy) — 4/4 green (rev 3), 5/5 (rev 4).
- `npx expo export --platform web` — succeeds; browser flows pass (desktop + mobile).
- Rev 4 screenshots: `%TEMP%\opencode\hp-check\korea-desktop.png`, `korea-mobile.png`.
- Screenshots: `%TEMP%\opencode\hp-check\final-desktop.png`, `mob.png` (rev 2 flow).