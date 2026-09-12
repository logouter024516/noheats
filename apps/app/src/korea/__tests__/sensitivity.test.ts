import { sweepHeatWeight, describeSweep, DEFAULT_SWEEP } from '../sensitivity';
import { EULJIRO_TO_SEOUL_STATION, EULJIRO_TO_MYEONGDONG, HOT_WEATHER } from '../../domain/fixtures';

describe('korea/sensitivity — heat-weight sweep', () => {
  it('sweeps the default range at fixed increments', () => {
    const analysis = sweepHeatWeight(EULJIRO_TO_SEOUL_STATION, HOT_WEATHER);
    expect(analysis.points.length).toBe(DEFAULT_SWEEP.length);
    expect(analysis.points[0].heatWeight).toBe(0.2);
    expect(analysis.points[analysis.points.length - 1].heatWeight).toBe(0.6);
  });

  it('finds a crossover from walking to transit as heat weight rises', () => {
    const analysis = sweepHeatWeight(EULJIRO_TO_MYEONGDONG, HOT_WEATHER);
    expect(analysis.crossover).not.toBeNull();
    const first = analysis.points[0];
    const crossover = analysis.crossover!;
    const at = analysis.points.find((p) => p.heatWeight === crossover.heatWeight)!;
    expect(first.recommendedId).not.toBe(at.recommendedId);
    expect(describeSweep(analysis)).toContain('추천');
  });

  it('reports no crossover when the winner is stable', () => {
    // 서울역 trip: transit is short; walking large penalty even at low heat weight
    const analysis = sweepHeatWeight(EULJIRO_TO_SEOUL_STATION, HOT_WEATHER);
    expect(analysis.crossover).toBeNull();
    expect(describeSweep(analysis)).toContain('추천이 바뀌지 않습니다');
  });

  it('handles an empty route list', () => {
    const analysis = sweepHeatWeight([], HOT_WEATHER);
    expect(analysis.points).toEqual([]);
    expect(analysis.crossover).toBeNull();
  });
});