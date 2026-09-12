/**
 * HeatPizza provider proxy — local development server.
 *
 * Thin HTTP wrapper around the shared handler in `proxy-handler.mjs`, which is
 * also served as a Vercel serverless function from `/api/proxy.mjs`. Run:
 *   TRANSIT_API_KEY=<key> TRANSIT_PROVIDER=odsay|seoul KAKAO_REST_KEY=<key> node transit-server.mjs
 *
 * An optional `apps/proxy/.env` file is loaded automatically (TRANSIT_API_KEY=,
 * KEY=, KAKAO_REST_KEY=, TRANSIT_PROVIDER=). Keyed endpoints:
 *   GET  /health
 *   GET  /api/places?q=<query>      -> Kakao Local keyword + address search (KAKAO_REST_KEY)
 *   GET  /api/reverse?lat&lon=      -> Kakao coord2address reverse geocode (KAKAO_REST_KEY)
 *   POST /api/transit               -> transit directions (TRANSIT_API_KEY)
 *                                      provider=odsay: ODsay searchPubTransPathT
 *                                      provider=seoul: 서울시 대중교통환승경로 ws.bus.go.kr
 *   GET  /api/driving               -> Kakao Navi 자동차 길찾기 (KAKAO_REST_KEY)
 *   GET  /api/kakao-route           -> 카카오맵 길찾기 웹 링크 (WGS84 -> WCONGNAMUL via transcoord) (KAKAO_REST_KEY)
 *
 * This module must never be bundled into the app.
 */

import http from 'node:http';
import { handleProxyRequest, PROVIDER, KEY } from './proxy-handler.mjs';

const PORT = Number(process.env.PORT ?? 3001);
const server = http.createServer(handleProxyRequest);

server.listen(PORT, () => {
  console.log(`[heatpizza-transit] listening on :${PORT} provider=${PROVIDER} key=${KEY ? 'set' : 'unset'}`);
});