import { ScoredOption, WeatherSnapshot, Timings } from '../domain/types';

export type ExposureLevel = '낮음' | '중간' | '높음';

export function exposureLevel(heatBurden: number): ExposureLevel {
  if (heatBurden >= 60) return '높음';
  if (heatBurden >= 30) return '중간';
  return '낮음';
}

export type ModeGlyph = 'walk' | 'bus' | 'subway' | 'train' | 'car';

export function modeGlyph(route: Pick<ScoredOption, 'mode' | 'label'>): ModeGlyph {
  if (route.mode === 'walk') return 'walk';
  if (route.mode === 'car') return 'car';
  if (route.label.includes('지하철')) return 'subway';
  if (route.label.includes('버스')) return 'bus';
  if (route.label.includes('기차')) return 'train';
  return 'subway';
}

export function recommendedVerb(route: Pick<ScoredOption, 'mode' | 'label'>): string {
  if (route.mode === 'walk') return '걸어가세요';
  if (route.mode === 'car') return '차로 이동하세요';
  if (route.label.includes('지하철')) return '지하철을 타세요';
  if (route.label.includes('버스')) return '버스를 타세요';
  return '대중교통을 이용하세요';
}

export function reasonLine(recommended: ScoredOption, fastest: ScoredOption): string {
  if (recommended.id === fastest.id) {
    if (recommended.outdoorExposureMin === 0) {
      return '야외에 거의 노출되지 않는, 빠르고 시원한 방법이에요.';
    }
    return '시간과 더위 부담을 함께 고려했을 때 가장 균형 잡힌 방법이에요.';
  }

  const extraMin = Math.max(0, recommended.durationMin - fastest.durationMin);
  const savedExposure = Math.max(0, fastest.outdoorExposureMin - recommended.outdoorExposureMin);

  if (recommended.mode !== 'walk' && fastest.mode === 'walk') {
    return '지금 기온과 야외 노출 시간을 고려하면 도보보다 대중교통이 더 적합해요.';
  }
  if (savedExposure > 0 && extraMin > 0) {
    return `${extraMin}분 더 걸리지만, 야외 노출을 ${savedExposure}분 줄여 열에 노출되는 시간을 아껴줘요.`;
  }
  if (savedExposure > 0) {
    return `더 빠르면서도 야외 노출을 ${savedExposure}분 줄여주는 방법이에요.`;
  }
  return `소요 시간은 비슷하면서 야외 노출이 더 적은 방법이에요.`;
}

export function weatherMood(weather: WeatherSnapshot): string {
  const temp = weather.temperatureC;
  if (temp >= 33) return '무더위';
  if (temp >= 30) return '덥고 습함';
  if (temp >= 26) return '조금 더움';
  if (temp >= 20) return '선선함';
  return '서늘함';
}

export function weatherDataTag(weather: WeatherSnapshot): string {
  if (weather.dataQuality === 'live') return '실시간';
  if (weather.dataQuality === 'estimated') return '추정';
  return '데모';
}

export function formatTimings(timings: Timings): string | null {
  const parts: Array<[string, number]> = [];
  if (timings.weatherMs != null) parts.push(['날씨', timings.weatherMs]);
  if (timings.walkingMs != null) parts.push(['도보', timings.walkingMs]);
  if (timings.transitMs != null) parts.push(['대중교통', timings.transitMs]);
  if (timings.drivingMs != null) parts.push(['차량', timings.drivingMs]);
  if (timings.decisionEngineMs != null) parts.push(['판단', timings.decisionEngineMs]);
  if (parts.length === 0) return null;
  const detail = parts.map(([k, ms]) => `${k} ${ms}ms`).join(' · ');
  const total = timings.totalMs != null ? ` · 전체 ${timings.totalMs}ms` : '';
  return `${detail}${total}`;
}

export function segmentChain(route: ScoredOption): string | null {
  if (!route.segments || route.segments.length === 0) return null;
  return route.segments
    .map((s) => (s.durationMin > 0 ? `${s.label} ${s.durationMin}분` : s.label))
    .join(' → ');
}