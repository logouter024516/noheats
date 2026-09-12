/**
 * Asia/Seoul time handling.
 *
 * South Korea uses UTC+09:00 year-round; there is no daylight saving time.
 * Everything user-facing and everything the Decision Engine needs goes through
 * explicit ISO 8601 timestamps with a +09:00 suffix. No ambiguous "8:00" strings,
 * no reliance on browser-local timezone.
 */
export const KOREAN_TIMEZONE = 'Asia/Seoul' as const;
export const KST_OFFSET_MS = 9 * 3600_000;

/** Parse an ISO timestamp (with or without offset) into epoch milliseconds. */
export function parseKstMs(iso: string): number {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) throw new Error(`Invalid time: ${iso}`);
  return ms;
}

/** epoch ms → ISO 8601 with explicit +09:00 suffix, shifted to KST wall time. */
export function toKstIso(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().replace('Z', '+09:00');
}

/**
 * KST wall-clock ISO → epoch ms. Accepts any parseable ISO; a bare
 * '+09:00' suffix keeps the wall time already in KST.
 */
export function fromKstIso(iso: string): number {
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) throw new Error(`Invalid time: ${iso}`);
  return parsed;
}

/** Now in KST, ISO +09:00. */
export function kstNow(): string {
  return toKstIso(Date.now());
}

/** Shift an ISO timestamp by minutes; returns ISO +09:00. */
export function shiftMinutes(iso: string, minutes: number): string {
  return toKstIso(parseKstMs(iso) + minutes * 60_000);
}

export type KstParts = {
  year: number;
  month: number;
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
  dayOfWeek: number; // 0 = Sunday
  epochMs: number;
};

/** Extract KST wall-clock parts from an ISO timestamp. */
export function kstParts(iso: string): KstParts {
  const epochMs = parseKstMs(iso);
  const kst = new Date(epochMs + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
    second: kst.getUTCSeconds(),
    dayOfWeek: kst.getUTCDay(),
    epochMs,
  };
}

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;

/** "오전 9:05" / "오후 2:30" — 12-hour Korean wall clock. */
export function formatKoreanClock(iso: string): string {
  const { hour, minute } = kstParts(iso);
  const meridiem = hour < 12 ? '오전' : '오후';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem} ${h12}:${String(minute).padStart(2, '0')}`;
}

/** "오후 2:30 (14:30)" — Korean-friendly primary, 24-hour secondary. */
export function formatKoreanClockDetailed(iso: string): string {
  const { hour, minute } = kstParts(iso);
  return `${formatKoreanClock(iso)} (${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')})`;
}

/** "9월 10일 목요일 오후 2:30" */
export function formatKoreanDateTime(iso: string): string {
  const p = kstParts(iso);
  return `${p.month}월 ${p.day}일 ${DAY_NAMES[p.dayOfWeek]} ${formatKoreanClock(iso)}`;
}

/** Whether two timestamps fall on the same KST calendar day. */
export function sameKstDay(a: string, b: string): boolean {
  const pa = kstParts(a);
  const pb = kstParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}