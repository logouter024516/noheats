/**
 * Provider-proxy base URL for the current runtime.
 *
 * - `EXPO_PUBLIC_API_BASE` overrides everything (deployed behind a custom
 *   API domain).
 * - Local dev (`localhost` / `127.0.0.1`) talks to the local keyed proxy on
 *   port 3001.
 * - Any other origin assumes the proxy is served at `/api` on the same host
 *   (Vercel deployment), so there is no CORS and no cross-origin key leak.
 */
export function apiBase(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (typeof window === 'undefined' || !window.location) return 'http://localhost:3001/';
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3001/`;
  }
  return `${protocol}//${hostname}/`;
}

/** Proxy endpoint URL for a path like '/api/transit'. */
export function apiUrl(path: string): string {
  const base = apiBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}