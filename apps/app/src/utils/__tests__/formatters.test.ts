import { exposureLevel, modeGlyph, recommendedVerb, reasonLine, weatherMood } from '../format';
import {
  EULJIRO_TO_MYEONGDONG,
  HOT_WEATHER,
  MILD_WEATHER,
} from '../../domain/fixtures';
import { rank } from '../../domain/engine';

describe('format helpers', () => {
  it('classifies exposure level', () => {
    expect(exposureLevel(10)).toBe('낮음');
    expect(exposureLevel(45)).toBe('중간');
    expect(exposureLevel(70)).toBe('높음');
  });

  it('maps mode and labels', () => {
    expect(modeGlyph({ mode: 'walk', label: '도보' })).toBe('walk');
    expect(modeGlyph({ mode: 'transit', label: '지하철 4호선' })).toBe('subway');
    expect(modeGlyph({ mode: 'transit', label: '버스 104번' })).toBe('bus');
  });

  it('builds verbs', () => {
    expect(recommendedVerb({ mode: 'walk', label: '도보' })).toBe('걸어가세요');
    expect(recommendedVerb({ mode: 'transit', label: '버스 104번' })).toBe('버스를 타세요');
    expect(recommendedVerb({ mode: 'transit', label: '지하철 4호선' })).toBe('지하철을 타세요');
  });

  it('weather mood reflects temperature', () => {
    expect(weatherMood(HOT_WEATHER)).toBe('무더위');
    expect(weatherMood(MILD_WEATHER)).toBe('선선함');
  });

  it('reason line explains trade-off between recommended and fastest', () => {
    const recommendation = rank(EULJIRO_TO_MYEONGDONG, HOT_WEATHER);
    const line = reasonLine(recommendation.recommended, recommendation.fastestBaseline);
    expect(line).toContain('대중교통');
    expect(line).toContain('도보');
  });

  it('reason line stays calm when recommendation equals fastest', () => {
    const recommendation = rank(EULJIRO_TO_MYEONGDONG, MILD_WEATHER);
    const line = reasonLine(recommendation.recommended, recommendation.fastestBaseline);
    expect(line).toContain('균형');
  });
});

describe('fixture scenario sanity', () => {
  it('HOT weather favors non-walk for Myeongdong', () => {
    const recommendation = rank(EULJIRO_TO_MYEONGDONG, HOT_WEATHER);
    expect(recommendation.recommended.id).toBe('transit-md');
  });

  it('MILD weather favors walk for Myeongdong', () => {
    const recommendation = rank(EULJIRO_TO_MYEONGDONG, MILD_WEATHER);
    expect(recommendation.recommended.id).toBe('walk-md');
  });

  it('fastest baseline is the shortest duration route', () => {
    const recommendation = rank(EULJIRO_TO_MYEONGDONG, HOT_WEATHER);
    expect(recommendation.fastestBaseline.id).toBe('walk-md');
  });
});
