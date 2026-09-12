import {
  kstParts,
  toKstIso,
  shiftMinutes,
  formatKoreanClock,
  formatKoreanClockDetailed,
  formatKoreanDateTime,
  sameKstDay,
} from '../time';

describe('korea/time — Asia/Seoul handling (UTC+09:00, no DST)', () => {
  it('emits ISO with explicit +09:00 offset', () => {
    const iso = toKstIso(new Date('2026-09-12T05:00:00Z').getTime());
    expect(iso.endsWith('+09:00')).toBe(true);
    expect(new Date(iso).toISOString()).toBe('2026-09-12T05:00:00.000Z');
  });

  it('round-trips shiftMinutes across a KST-day boundary', () => {
    const before = '2026-09-11T23:30:00+09:00';
    const after = shiftMinutes(before, 45);
    const p = kstParts(after);
    expect(p.day).toBe(12);
    expect(p.hour).toBe(0);
    expect(p.minute).toBe(15);
    expect(sameKstDay(before, before)).toBe(true);
    expect(sameKstDay(before, after)).toBe(false);
  });

  it('extracts KST wall-clock parts regardless of browser timezone', () => {
    // 2026-09-12T00:30:00+09:00 == 2026-09-11T15:30:00Z
    const p = kstParts('2026-09-12T00:30:00+09:00');
    expect({ year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute }).toEqual({
      year: 2026,
      month: 9,
      day: 12,
      hour: 0,
      minute: 30,
    });
  });

  it('formats Korean 12-hour clock with 오전/오후', () => {
    expect(formatKoreanClock('2026-09-12T09:05:00+09:00')).toBe('오전 9:05');
    expect(formatKoreanClock('2026-09-12T14:30:00+09:00')).toBe('오후 2:30');
    expect(formatKoreanClock('2026-09-12T00:30:00+09:00')).toBe('오전 12:30');
    expect(formatKoreanClock('2026-09-12T12:00:00+09:00')).toBe('오후 12:00');
  });

  it('combines 24-hour secondary and date text', () => {
    expect(formatKoreanClockDetailed('2026-09-12T14:05:00+09:00')).toBe('오후 2:05 (14:05)');
    expect(formatKoreanDateTime('2026-09-12T14:05:00+09:00')).toBe('9월 12일 토요일 오후 2:05');
  });

  it('throws on invalid input', () => {
    expect(() => kstParts('not-a-date')).toThrow();
  });
});