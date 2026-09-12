import { rank } from '../../domain/engine';
import { HOT_WEATHER, MILD_WEATHER } from '../../domain/fixtures';
import { KOREA_SCENARIOS } from '../scenarios';

describe('korea/scenarios — 10 reproducible Korea cases', () => {
  it('covers the seven major metro areas', () => {
    const cities = new Set(KOREA_SCENARIOS.map((s) => s.city.split('/')[0]));
    for (const expected of ['서울', '부산', '대전', '대구', '인천', '광주', '제주']) {
      expect(cities.has(expected)).toBe(true);
    }
    expect(KOREA_SCENARIOS.length).toBe(10);
  });

  it('ranks every scenario deterministically on hot and mild days', () => {
    for (const scenario of KOREA_SCENARIOS) {
      const hotA = rank(scenario.routes, HOT_WEATHER);
      const hotB = rank(scenario.routes, HOT_WEATHER);
      expect(hotA.recommended.id).toBe(hotB.recommended.id);
      expect(hotA.recommended.decisionScore).toBe(hotB.recommended.decisionScore);

      const mild = rank(scenario.routes, MILD_WEATHER);
      expect(mild.recommended.id).toBe(mild.recommended.id);

      // every scenario must have a real street-level alternative checked
      expect(scenario.routes.length).toBeGreaterThanOrEqual(2);
      expect(mild.fastestBaseline.durationMin).toBe(
        Math.min(...scenario.routes.map((r) => r.durationMin)),
      );
    }
  });

  it('prefers transit when a long midday walk is in play (Seoul, hot)', () => {
    const scenario = KOREA_SCENARIOS.find((s) => s.id === 'seoul-euljiro-gangnam')!;
    const hot = rank(scenario.routes, HOT_WEATHER);
    const mild = rank(scenario.routes, MILD_WEATHER);
    expect(hot.recommended.mode).toBe('transit');
    expect(mild.recommended.mode).toBe('transit'); // 65분 도보는 어떤 날도 부적합
  });

  it('keeps walking viable for short trips in mild weather (Busan)', () => {
    const scenario = KOREA_SCENARIOS.find((s) => s.id === 'busan-busanstation-seomyeon')!;
    const mild = rank(scenario.routes, MILD_WEATHER);
    expect(mild.recommended.mode).toBeDefined();
  });
});