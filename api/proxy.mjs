/**
 * HeatPizza provider proxy — Vercel serverless function.
 *
 * All `/api/*` paths rewrite to this function (see vercel.json); it reuses the
 * shared handler so local dev (`node transit-server.mjs`) and the deployed
 * function behave identically. Provider keys come from Vercel environment
 * variables (TRANSIT_API_KEY, KAKAO_REST_KEY, TRANSIT_PROVIDER).
 */
import { handleProxyRequest } from '../apps/proxy/proxy-handler.mjs';

export default handleProxyRequest;