import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Recommendation, ScoredOption, Timings } from '../domain/types';
import { Place } from '../domain/types';
import {
  exposureLevel,
  modeGlyph,
  recommendedVerb,
  reasonLine,
  weatherMood,
  weatherDataTag,
  formatTimings,
  segmentChain,
} from '../utils/format';
import { WeatherSnapshot } from '../domain/types';
import { useTheme } from '../hooks/use-theme';
import { fetchKakaoRouteLink } from '../adapters/kakaoRoute';

type Props = {
  recommendation: Recommendation;
  weather: WeatherSnapshot | null;
  dataStatus: 'live' | 'partial' | 'demo' | 'idle' | 'error';
  timings: Timings;
  selectedRouteId: string | null;
  origin: Place | null;
  destination: Place | null;
  onSelectRoute: (id: string) => void;
  onDepartureShift: (minutes: number) => void;
  onReset: () => void;
};

function modeIcon(glyph: ReturnType<typeof modeGlyph>) {
  switch (glyph) {
    case 'walk': return 'walk';
    case 'bus': return 'bus';
    case 'subway': return 'train';
    case 'train': return 'train';
    case 'car': return 'car';
    default: return 'map-marker-distance';
  }
}

export function ResultCard({ recommendation, weather, dataStatus, timings, selectedRouteId, origin, destination, onSelectRoute, onDepartureShift, onReset }: Props) {
  const theme = useTheme();
  const [routeLinkState, setRouteLinkState] = useState<'idle' | 'loading' | 'error'>('idle');
  const { recommended, fastestBaseline, alternatives } = recommendation;
  const picked = alternatives.find((alt) => alt.id === selectedRouteId) ?? null;
  const display = picked ?? recommended;
  const isPick = picked !== null;
  const isDivergent = recommended.id !== fastestBaseline.id;
  const chain = segmentChain(display);
  const timingLine = formatTimings(timings);
  const altList = isPick
    ? [recommended, ...alternatives.filter((alt) => alt.id !== picked.id)]
    : alternatives;

  const openInKakaoMap = useCallback(async () => {
    if (!origin || !destination) return;
    setRouteLinkState('loading');
    try {
      const landingUrl = await fetchKakaoRouteLink(origin, destination);
      if (typeof window !== 'undefined') window.open(landingUrl, '_blank', 'noopener');
      setRouteLinkState('idle');
    } catch {
      setRouteLinkState('error');
    }
  }, [origin, destination]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {isPick && (
          <View style={[styles.pickChip, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.pickChipText, { color: theme.accent }]}>선택한 방법</Text>
          </View>
        )}
        <Text style={[styles.verb, { color: theme.text }]}>{recommendedVerb(display)}</Text>
        <Text style={[styles.reason, { color: theme.textSecondary }]}>{reasonLine(display, fastestBaseline)}</Text>
      </View>

      <View style={[styles.mainCard, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.mainTop}>
          <MaterialCommunityIcons name={modeIcon(modeGlyph(display)) as any} size={22} color={theme.accent} />
          <Text style={[styles.mainLabel, { color: theme.text }]}>{display.label}</Text>
          <Text style={[styles.mainDuration, { color: theme.accent }]}>{display.durationMin}분</Text>
        </View>
        <View style={styles.mainStats}>
          <Stat icon="weather-sunny" label="야외" value={`${display.outdoorExposureMin}분`} color={theme.heatMild} theme={theme} />
          <Stat icon="thermometer" label="부담" value={exposureLevel(display.heatBurden)} color={display.heatBurden >= 60 ? theme.heat : theme.text} theme={theme} />
          {display.waitMin > 0 && <Stat icon="clock-outline" label="대기" value={`${display.waitMin}분`} color={theme.textSecondary} theme={theme} />}
          {display.transfers > 0 && <Stat icon="swap-horizontal" label="환승" value={`${display.transfers}회`} color={theme.textSecondary} theme={theme} />}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.kakaoBtn, { backgroundColor: theme.accent }]}
        onPress={openInKakaoMap}
        disabled={routeLinkState === 'loading'}
      >
        {routeLinkState === 'loading' ? (
          <MaterialCommunityIcons name="progress-clock" size={16} color={theme.accentText} />
        ) : (
          <MaterialCommunityIcons name="directions" size={16} color={theme.accentText} />
        )}
        <Text style={[styles.kakaoBtnText, { color: theme.accentText }]}>
          {routeLinkState === 'loading' ? '여는 중…' : '이 경로로 길찾기'}
        </Text>
      </TouchableOpacity>
      {routeLinkState === 'error' && (
        <Text style={[styles.linkError, { color: theme.heat }]}>
          길찾기 링크를 열지 못했어요. 잠시 후 다시 시도해 주세요.
        </Text>
      )}

      {weather && (
        <View style={styles.weatherRow}>
          <MaterialCommunityIcons name="white-balance-sunny" size={14} color={theme.heatMild} />
          <Text style={[styles.weatherText, { color: theme.textSecondary }]}>
            {weather.temperatureC}° {weatherMood(weather)}
            {weather.humidityPct ? ` · 습도 ${weather.humidityPct}%` : ''}
            {weather.uvIndex != null ? ` · UV ${weather.uvIndex}` : ''}
            {' · '}{weatherDataTag(weather)}
          </Text>
        </View>
      )}

      {chain && (
        <View style={styles.segmentRow}>
          <MaterialCommunityIcons name="routes" size={14} color={theme.textSecondary} />
          <Text style={[styles.segmentText, { color: theme.textSecondary }]}>{chain}</Text>
        </View>
      )}

      <View style={styles.shiftRow}>
        <TouchableOpacity style={[styles.shiftBtn, { backgroundColor: theme.backgroundElement }]} onPress={() => onDepartureShift(-10)}>
          <Text style={[styles.shiftText, { color: theme.text }]}>-10분</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.shiftBtn, { backgroundColor: theme.backgroundElement }]} onPress={() => onDepartureShift(0)}>
          <Text style={[styles.shiftText, { color: theme.text }]}>지금</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.shiftBtn, { backgroundColor: theme.backgroundElement }]} onPress={() => onDepartureShift(10)}>
          <Text style={[styles.shiftText, { color: theme.text }]}>+10분</Text>
        </TouchableOpacity>
      </View>

      {!isPick && isDivergent && (
        <View style={[styles.baselineCard, { backgroundColor: theme.backgroundElement, borderLeftColor: theme.heatMild }]}>
          <Text style={[styles.baselineTitle, { color: theme.textSecondary }]}>기존 최단시간</Text>
          <Text style={[styles.baselineBody, { color: theme.text }]}>
            {fastestBaseline.label} {fastestBaseline.durationMin}분 · 야외 {fastestBaseline.outdoorExposureMin}분
          </Text>
          <Text style={[styles.baselineDelta, { color: theme.accent }]}>
            {recommended.durationMin - fastestBaseline.durationMin > 0
              ? `${recommended.durationMin - fastestBaseline.durationMin}분 더 걸리지만, `
              : `${fastestBaseline.durationMin - recommended.durationMin}분 더 빠르면서, `}
            야외 노출 {Math.abs(fastestBaseline.outdoorExposureMin - recommended.outdoorExposureMin)}분 {fastestBaseline.outdoorExposureMin > recommended.outdoorExposureMin ? '줄여' : '늘리며'}
          </Text>
        </View>
      )}

      {altList.length > 0 && (
        <View style={styles.altSection}>
          <Text style={[styles.altTitle, { color: theme.textSecondary }]}>다른 방법</Text>
          {altList.map((alt) => (
            <TouchableOpacity
              key={alt.id}
              style={[styles.altRow, { borderBottomColor: theme.border }]}
              onPress={() => onSelectRoute(alt.id)}
            >
              <MaterialCommunityIcons name={modeIcon(modeGlyph(alt)) as any} size={16} color={theme.textSecondary} />
              <Text style={[styles.altLabel, { color: theme.text }]}>{alt.label}</Text>
              {alt.id === recommended.id && (
                <View style={[styles.recoChip, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.recoChipText, { color: theme.accentText }]}>추천</Text>
                </View>
              )}
              <Text style={[styles.altDuration, { color: theme.textSecondary }]}>{alt.durationMin}분</Text>
              <Text style={[styles.altExposure, { color: alt.heatBurden >= 60 ? theme.heat : theme.textSecondary }]}>
                야외 {alt.outdoorExposureMin}분
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {dataStatus !== 'live' && (
        <View style={styles.demoBadge}>
          <MaterialCommunityIcons name="information-outline" size={12} color={theme.textSecondary} />
          <Text style={[styles.demoText, { color: theme.textSecondary }]}>
            {dataStatus === 'demo'
              ? '미리보기 데이터로 계산한 결과예요.'
              : dataStatus === 'error'
                ? '일부 데이터에 문제가 생겼어요. 다시 시도해주세요.'
                : '여러 경로는 실시간 데이터로 계산했어요. 일부는 미리보기 데이터예요 (API 키 필요).'}
          </Text>
        </View>
      )}

      {timingLine && (
        <Text style={[styles.timingText, { color: theme.textSecondary }]}>{timingLine}</Text>
      )}

      <TouchableOpacity style={[styles.resetBtn, { backgroundColor: theme.backgroundElement }]} onPress={onReset}>
        <MaterialCommunityIcons name="refresh" size={14} color={theme.textSecondary} />
        <Text style={[styles.resetText, { color: theme.textSecondary }]}>다시 검색</Text>
      </TouchableOpacity>
    </View>
  );
}

function Stat({ icon, label, value, color, theme }: { icon: string; label: string; value: string; color: string; theme: any }) {
  return (
    <View style={statStyles.wrap}>
      <MaterialCommunityIcons name={icon as any} size={12} color={color} />
      <Text style={[statStyles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 11 },
  value: { fontSize: 12, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { gap: 10 },
  header: { gap: 4 },
  pickChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pickChipText: { fontSize: 10, fontWeight: '700' },
  verb: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  reason: { fontSize: 13, lineHeight: 18 },
  mainCard: { borderRadius: 14, padding: 16, gap: 12 },
  mainTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mainLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  mainDuration: { fontSize: 18, fontWeight: '800' },
  mainStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kakaoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  kakaoBtnText: { fontSize: 15, fontWeight: '700' },
  linkError: { fontSize: 12 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weatherText: { fontSize: 12 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentText: { fontSize: 12, flexShrink: 1 },
  timingText: { fontSize: 10, textAlign: 'right' },
  shiftRow: { flexDirection: 'row', gap: 6 },
  shiftBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  shiftText: { fontSize: 13, fontWeight: '600' },
  baselineCard: { borderRadius: 10, padding: 12, borderLeftWidth: 3, gap: 4 },
  baselineTitle: { fontSize: 11, fontWeight: '600' },
  baselineBody: { fontSize: 13, fontWeight: '500' },
  baselineDelta: { fontSize: 12, lineHeight: 17 },
  altSection: { gap: 6 },
  altTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  altLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  recoChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  recoChipText: { fontSize: 10, fontWeight: '700' },
  altDuration: { fontSize: 13, fontWeight: '600' },
  altExposure: { fontSize: 12, minWidth: 60, textAlign: 'right' },
  demoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  demoText: { fontSize: 11 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  resetText: { fontSize: 13, fontWeight: '500' },
});
