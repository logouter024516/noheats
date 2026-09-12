/**
 * Pure ODsay response normalization.
 *
 * Kept dependency-free so it can run inside the proxy (Node) and be unit-tested
 * with `node --test`. ODsay's raw shape stays out of the client; the proxy
 * returns these normalized RouteOption-likes.
 */

const TRAFFIC_SUBWAY = 1;
const TRAFFIC_BUS = 2;
const TRAFFIC_TRANSFER = 3;
const TRAFFIC_WALK = 4;
const TRAFFIC_TRAIN = 6;

/** epoch ms → ISO with explicit +09:00 wall time (Korea has no DST). */
function toKstIso(ms) {
  return new Date(ms + 9 * 3600_000).toISOString().replace('Z', '+09:00');
}

export function segmentMode(trafficType) {
  switch (trafficType) {
    case TRAFFIC_SUBWAY:
      return 'subway';
    case TRAFFIC_BUS:
      return 'bus';
    case TRAFFIC_TRAIN:
      return 'train';
    default:
      // 3 = transfer walk, 4 = walk; both are outdoor heat exposure
      return 'walk';
  }
}

export function segmentLabel(segment) {
  const mode = segmentMode(segment?.trafficType);
  if (mode === 'walk') return '도보';
  const laneName = Array.isArray(segment?.lane)
    ? segment.lane.map((l) => l.name).filter(Boolean).join(' ')
    : '';
  if (laneName) return laneName;
  if (mode === 'subway') return '지하철';
  if (mode === 'bus') return '버스';
  return '기차';
}

function segmentGeometry(segment) {
  const stations = segment?.passStopList?.stations?.map((st) => ({
    latitude: st.y,
    longitude: st.x,
  })) ?? [];
  const out = [];
  if (segment?.startX && segment?.startY) out.push({ latitude: segment.startY, longitude: segment.startX });
  out.push(...stations);
  if (segment?.endX && segment?.endY) out.push({ latitude: segment.endY, longitude: segment.endX });
  return out.filter((p) => p.latitude && p.longitude);
}

function deriveTransferCount(subPath) {
  // count of vehicle runs minus 1: consecutive vehicle segments form a run
  let runs = 0;
  let inVehicle = false;
  for (const s of subPath) {
    const riding = [TRAFFIC_SUBWAY, TRAFFIC_BUS, TRAFFIC_TRAIN].includes(s.trafficType);
    if (riding && !inVehicle) runs += 1;
    inVehicle = riding;
  }
  return Math.max(0, runs - 1);
}

/**
 * Normalize an ODsay searchPubTransPathT payload into RouteOption-likes.
 * `arrivalTime` is the client-requested ISO arrival (+09:00).
 */
export function normalizeOdsay(data, arrivalTime) {
  const paths = data?.result?.path;
  if (!Array.isArray(paths)) return [];

  const arrivalMs = new Date(arrivalTime).getTime();

  return paths.slice(0, 4).map((path, i) => {
    const info = path?.info ?? {};
    const subPath = Array.isArray(path?.subPath) ? path.subPath : [];

    const totalMin = Math.max(1, Math.round((info.totalTime ?? 0) / 60));

    const segments = subPath.map((s) => {
      const mode = segmentMode(s.trafficType);
      const sectionTimeSec = Number(s.sectionTime) || 0;
      return {
        mode,
        label: segmentLabel(s),
        sectionTime: sectionTimeSec,
        distance: s.distance,
        startName: s.startName,
        endName: s.endName,
        geometry: segmentGeometry(s),
        trafficType: s.trafficType,
        sectionTimeMin: Math.round(sectionTimeSec / 60),
      };
    });

    // walking = trafficType 4; exposed transfer walk = trafficType 3
    const walkSec = subPath
      .filter((s) => s.trafficType === TRAFFIC_WALK)
      .reduce((a, s) => a + (Number(s.sectionTime) || 0), 0);
    const vehicleSec = subPath
      .filter((s) => [TRAFFIC_SUBWAY, TRAFFIC_BUS, TRAFFIC_TRAIN].includes(s.trafficType))
      .reduce((a, s) => a + (Number(s.sectionTime) || 0), 0);

    const walkMin = Math.max(0, Math.round(walkSec / 60));
    let waitMin = Math.max(0, Math.round((totalMin * 60 - walkSec - vehicleSec) / 60));
    // totalTime is approximate; fall back to a documented heuristic when the
    // derivation is implausible or zero.
    if (waitMin === 0 && vehicleSec > 0) {
      waitMin = Math.max(1, Math.round(vehicleSec / 60 / 4));
    }

    const transferCount = deriveTransferCount(subPath);

    const label =
      segments
        .filter((s) => s.mode !== 'walk')
        .map((s) => s.label)
        .slice(0, 2)
        .join(' → ') || '대중교통';

    return {
      id: `transit-odsay-${i}`,
      mode: 'transit',
      label,
      durationMin: totalMin,
      walkMin,
      waitMin,
      transfers: transferCount,
      geometry: segments.flatMap((s) => s.geometry),
      segments: segments.map(({ mode, label: segLabel, sectionTimeMin, distance, startName, endName }) => ({
        mode,
        label: segLabel,
        durationMin: sectionTimeMin,
        outdoor: mode === 'walk',
        startName,
        endName,
        distance,
      })),
      departureAt: toKstIso(arrivalMs - totalMin * 60_000),
      arrivalAt: arrivalTime,
      source: 'ODsay',
      dataQuality: 'live',
    };
  });
}