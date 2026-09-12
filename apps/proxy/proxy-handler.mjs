/**
 * HeatPizza provider proxy — shared request handler.
 *
 * Works both as a local long-running server (wrapped by transit-server.mjs)
 * and as a Vercel serverless function (re-exported from /api/proxy.mjs).
 * Hides provider API keys from the client bundle. Reads keys from
 * `process.env` (Vercel env) or an optional `apps/proxy/.env` file.
 *
 * Endpoints:
 *   GET  /health                    -> availability + which keys are set
 *   GET  /api/places?q=<query>      -> Kakao Local keyword + address search
 *   GET  /api/reverse?lat&lon=      -> Kakao coord2address reverse geocode
 *   POST /api/transit               -> transit directions (seoul | odsay)
 *   GET  /api/driving               -> Kakao Navi 자동차 길찾기
 *   GET  /api/kakao-route           -> 카카오맵 길찾기 웹 링크 (WGS84 -> WCONGNAMUL)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOdsay } from './normalize-odsay.mjs';
import { normalizeSeoul } from './normalize-seoul.mjs';
import { normalizeKakaoNavi } from './normalize-kakao-navi.mjs';
import { xmlToJson } from './xml-simple.mjs';
import {
  normalizeKakaoPlace,
  normalizeKakaoAddress,
  normalizeKakaoReverse,
  dedupePlacesByCoord,
} from './normalize-kakao-place.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(file = path.join(__dirname, '.env')) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    // no .env file — env vars only
  }
}
loadEnvFile();

const PROVIDER = process.env.TRANSIT_PROVIDER ?? 'odsay';
const KEY = process.env.TRANSIT_API_KEY ?? '';
const KAKAO_KEY = process.env.KAKAO_REST_KEY ?? '';

const READ_TIMEOUT_MS = 12_000;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        reject(new Error('bad JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function fetchSeoulTransit(originLat, originLon, destLat, destLon, time) {
  // The data.go.kr serviceKey is already percent-encoded (it contains %2B etc.),
  // so interpolation is raw; URLSearchParams would double-encode % and 401.
  const url =
    'http://ws.bus.go.kr/api/rest/pathinfo/getPathInfoByBusNSub?' +
    `ServiceKey=${KEY}` +
    `&startX=${originLon}&startY=${originLat}&endX=${destLon}&endY=${destLat}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(READ_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Seoul transit ${res.status}`);
  return xmlToJson(await res.text());
}

async function fetchKakaoDriving(originLat, originLon, destLat, destLon, time) {
  const url =
    'https://apis-navi.kakaomobility.com/v1/directions?' +
    new URLSearchParams({
      origin: `${originLon},${originLat},name=출발지`,
      destination: `${destLon},${destLat},name=도착지`,
      priority: 'RECOMMEND',
      alternatives: 'false',
      road_details: 'false',
    });
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  const body = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new Error('카카오 길찾기 사용이 활성화되지 않았습니다 (카카오디벨로퍼스 제품 설정 필요)');
  }
  if (!res.ok) throw new Error(`Kakao Navi ${res.status}`);
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error('Kakao Navi 응답 파싱 실패');
  }
  return normalizeKakaoNavi(json, time);
}

async function fetchOdsay(originLat, originLon, destLat, destLon, time) {
  const arrival = new Date(time);
  const departure = Math.round(arrival.getTime() / 1000) - 60 * 30; // approx 30 min earlier
  const url =
    'https://api.odsay.com/v1/api/searchPubTransPathT?' +
    new URLSearchParams({
      apiKey: KEY,
      SX: String(originLon),
      SY: String(originLat),
      EX: String(destLon),
      EY: String(destLat),
      time: String(departure),
      searchType: '0',
    });
  const res = await fetch(url, { signal: AbortSignal.timeout(READ_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`ODsay ${res.status}`);
  return res.json();
}

async function fetchKakaoKeyword(query) {
  const url =
    'https://dapi.kakao.com/v2/local/search/keyword.json?' +
    new URLSearchParams({ query, size: '8' });
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Kakao Local keyword ${res.status}`);
  const json = await res.json();
  const docs = Array.isArray(json?.documents) ? json.documents : [];
  return docs.map(normalizeKakaoPlace).filter(Boolean);
}

async function fetchKakaoAddress(query) {
  const url =
    'https://dapi.kakao.com/v2/local/search/address.json?' +
    new URLSearchParams({ query, size: '6' });
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Kakao Local address ${res.status}`);
  const json = await res.json();
  const docs = Array.isArray(json?.documents) ? json.documents : [];
  return docs.map(normalizeKakaoAddress).filter(Boolean);
}

/** Keyword hits first (ranked by Kakao accuracy), address hits appended, coord-deduped. */
async function fetchKakaoPlaces(query) {
  const [keywords, addresses] = await Promise.allSettled([
    fetchKakaoKeyword(query),
    fetchKakaoAddress(query),
  ]);
  const places = [];
  if (keywords.status === 'fulfilled') places.push(...keywords.value);
  if (addresses.status === 'fulfilled') places.push(...addresses.value);
  return dedupePlacesByCoord(places);
}

async function fetchKakaoReverse(lat, lon) {
  const url =
    'https://dapi.kakao.com/v2/local/geo/coord2address.json?' +
    new URLSearchParams({ x: String(lon), y: String(lat), input_coord: 'WGS84' });
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Kakao Local reverse ${res.status}`);
  const json = await res.json();
  const doc = Array.isArray(json?.documents) ? json.documents[0] : null;
  return doc ? normalizeKakaoReverse(doc, lat, lon) : null;
}

/** WGS84 -> WCONGNAMUL (카카오맵 웹 길찾기 좌표계). X=lon, Y=lat. */
async function fetchKakaoTranscoord(x, y) {
  const url =
    'https://dapi.kakao.com/v2/local/geo/transcoord.json?' +
    new URLSearchParams({ x: String(x), y: String(y), input_coord: 'WGS84', output_coord: 'WCONGNAMUL' });
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Kakao Local transcoord ${res.status}`);
  const json = await res.json();
  const doc = Array.isArray(json?.documents) ? json.documents[0] : null;
  if (!doc) throw new Error('coord conversion returned no result');
  return { x: doc.x, y: doc.y };
}

export async function handleProxyRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      provider: PROVIDER,
      keyConfigured: Boolean(KEY),
      kakaoKeyConfigured: Boolean(KAKAO_KEY),
      drivingKeyConfigured: Boolean(KAKAO_KEY),
    });
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/places')) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const q = (url.searchParams.get('q') ?? '').trim();
      if (!q) {
        sendJson(res, 400, { error: 'missing q' });
        return;
      }
      if (!KAKAO_KEY) {
        sendJson(res, 404, { error: 'kakao Local API key not configured' });
        return;
      }
      const places = await fetchKakaoPlaces(q);
      sendJson(res, 200, { places });
    } catch (err) {
      sendJson(res, 502, { error: String(err?.message ?? err) });
    }
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/reverse')) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const lat = Number(url.searchParams.get('lat'));
      const lon = Number(url.searchParams.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        sendJson(res, 400, { error: 'missing lat/lon' });
        return;
      }
      if (!KAKAO_KEY) {
        sendJson(res, 404, { error: 'kakao Local API key not configured' });
        return;
      }
      const place = await fetchKakaoReverse(lat, lon);
      sendJson(res, 200, { place });
    } catch (err) {
      sendJson(res, 502, { error: String(err?.message ?? err) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/transit') {
    try {
      const body = await readBody(req);
      const { originLat, originLon, destLat, destLon, arrivalTime } = body;
      if ([originLat, originLon, destLat, destLon, arrivalTime].some((v) => v == null || v === '')) {
        sendJson(res, 400, { error: 'missing origin/destination/time' });
        return;
      }
      if (!KEY) {
        sendJson(res, 404, { error: 'transit API key not configured' });
        return;
      }

      let routes = [];
      if (PROVIDER === 'odsay') {
        const raw = await fetchOdsay(originLat, originLon, destLat, destLon, arrivalTime);
        routes = normalizeOdsay(raw, arrivalTime);
      } else if (PROVIDER === 'seoul') {
        const raw = await fetchSeoulTransit(originLat, originLon, destLat, destLon, arrivalTime);
        routes = normalizeSeoul(raw, arrivalTime, originLat, originLon, destLat, destLon);
      } else {
        sendJson(res, 501, { error: `unsupported provider ${PROVIDER}` });
        return;
      }

      sendJson(res, 200, { routes });
    } catch (err) {
      sendJson(res, 502, { error: String(err?.message ?? err) });
    }
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/driving')) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const originLat = Number(url.searchParams.get('originLat'));
      const originLon = Number(url.searchParams.get('originLon'));
      const destLat = Number(url.searchParams.get('destLat'));
      const destLon = Number(url.searchParams.get('destLon'));
      const arrivalTime = url.searchParams.get('arrivalTime') ?? '';
      if ([originLat, originLon, destLat, destLon].some((v) => !Number.isFinite(v)) || !arrivalTime) {
        sendJson(res, 400, { error: 'missing origin/destination/time' });
        return;
      }
      if (!KAKAO_KEY) {
        sendJson(res, 404, { error: 'kakao 길찾기 API 키가 설정되지 않았습니다' });
        return;
      }
      const routes = await fetchKakaoDriving(originLat, originLon, destLat, destLon, arrivalTime);
      sendJson(res, 200, { routes });
    } catch (err) {
      sendJson(res, 502, { error: String(err?.message ?? err) });
    }
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/kakao-route')) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const sx = Number(url.searchParams.get('sx'));
      const sy = Number(url.searchParams.get('sy'));
      const ex = Number(url.searchParams.get('ex'));
      const ey = Number(url.searchParams.get('ey'));
      const sName = url.searchParams.get('sName') ?? '';
      const eName = url.searchParams.get('eName') ?? '';
      if ([sx, sy, ex, ey].some((v) => !Number.isFinite(v))) {
        sendJson(res, 400, { error: 'missing/NaN start/end coordinates' });
        return;
      }
      if (!KAKAO_KEY) {
        sendJson(res, 404, { error: 'kakao API 키가 설정되지 않았습니다' });
        return;
      }
      const [start, end] = await Promise.all([
        fetchKakaoTranscoord(sx, sy),
        fetchKakaoTranscoord(ex, ey),
      ]);
      const params = new URLSearchParams({
        sX: String(start.x),
        sY: String(start.y),
        sName,
        eX: String(end.x),
        eY: String(end.y),
        eName,
      });
      sendJson(res, 200, { landingUrl: `https://map.kakao.com/?${params.toString()}` });
    } catch (err) {
      sendJson(res, 502, { error: String(err?.message ?? err) });
    }
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

export { PROVIDER, KEY, KAKAO_KEY };