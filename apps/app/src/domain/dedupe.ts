import { RouteOption } from './types';

const DEDUPE_TOLERANCE_MIN = 2;

function vehicleLegLabels(route: RouteOption): string[] {
  const segs = route.segments ?? [];
  const labels = segs
    .filter((s) => s.mode === 'bus' || s.mode === 'subway' || s.mode === 'train')
    .map((s) => s.label.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (labels.length > 0) return labels;
  return (route.label || '').split('→').map((l) => l.trim()).filter(Boolean);
}

function signature(route: RouteOption): string {
  return vehicleLegLabels(route).join(' → ');
}

/** Ordered chain of every vehicle leg AFTER the first board line. Routes that
 * share a tail differ only in which first bus line is boarded. */
function tailSignature(route: RouteOption): string | null {
  const labels = vehicleLegLabels(route);
  if (labels.length < 2) return null;
  return labels.slice(1).join(' → ');
}

/**
 * Collapse near-duplicate transit options. Two routes are duplicates when:
 *  - the ordered line chain is identical (same signature), or
 *  - they share the same transfer/tail chain and arrive within
 *    DEDUPE_TOLERANCE_MIN minutes of each other (differ only in the first bus).
 * The first accepted route wins (stable). Non-transit routes pass through.
 */
export function dedupeTransitOptions(routes: RouteOption[]): RouteOption[] {
  const out: RouteOption[] = [];
  const seenSig = new Set<string>();
  const seenTail = new Map<string, number>();

  for (const route of routes) {
    if (route.mode !== 'transit') {
      out.push(route);
      continue;
    }
    const sig = signature(route);
    if (seenSig.has(sig)) continue;
    seenSig.add(sig);

    const tail = tailSignature(route);
    if (tail) {
      const kept = seenTail.get(tail);
      if (kept != null && Math.abs(kept - route.durationMin) <= DEDUPE_TOLERANCE_MIN) continue;
      seenTail.set(tail, route.durationMin);
    }
    out.push(route);
  }
  return out;
}