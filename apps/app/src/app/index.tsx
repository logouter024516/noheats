import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';

import { RealMap } from '@/components/RealMap';
import { SearchInput } from '@/components/SearchInput';
import { ResultCard } from '@/components/ResultCard';
import { Place, ScoredOption } from '@/domain/types';
import { reverseGeocode } from '@/adapters/geocoding';
import { DepartureOffset, useHeatPizza } from '@/hooks/useHeatPizza';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { useTheme } from '@/hooks/use-theme';
import { kstNow, shiftMinutes } from '@/korea/time';

const BREAKPOINT_MOBILE = 768;

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width <= BREAKPOINT_MOBILE;
  const theme = useTheme();

  const {
    input,
    isLoading,
    recommendation,
    error,
    weather,
    selectedRouteId,
    departureOffset,
    dataStatus,
    timings,
    transitNote,
    setOrigin,
    setDestination,
    setArrivalTime,
    setDepartureOffset,
    selectRoute,
    search,
    reset,
  } = useHeatPizza();

  const {
    status: locationStatus,
    place: currentLocation,
    message: locationMessage,
    request: requestLocation,
  } = useCurrentLocation();

  const handleUseCurrentLocation = useCallback(() => {
    requestLocation();
  }, [requestLocation]);

  /**
   * Map tap → drop a pin. Fills the empty field first; when both are set it
   * replaces the destination (least surprising). Label comes from reverse
   * geocoding, else falls back to raw coordinates.
   */
  const handleMapClick = useCallback(
    async (lat: number, lon: number) => {
      const fillDestination =
        input.destination === null || input.origin !== null;
      let place: Place | null = null;
      try {
        place = await reverseGeocode(lat, lon);
      } catch {
        place = null;
      }
      const resolved: Place =
        place ?? {
          label: '지도에서 선택',
          subLabel: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          coordinate: { latitude: lat, longitude: lon },
          source: 'map-pin',
        };
      if (fillDestination) setDestination(resolved);
      else setOrigin(resolved);
    },
    [input.origin, input.destination, setOrigin, setDestination],
  );

  useEffect(() => {
    if (currentLocation) setOrigin(currentLocation);
  }, [currentLocation, setOrigin]);

  const places: Place[] = [input.origin, input.destination].filter(Boolean) as Place[];
  const routes: ScoredOption[] = recommendation
    ? [...recommendation.alternatives, recommendation.recommended]
    : [];

  const handleSearch = useCallback(() => {
    search();
  }, [search]);

  const handleDepartureShift = useCallback((minutes: number) => {
    const offset = (minutes as DepartureOffset);
    setDepartureOffset(offset);
    search(undefined, { departureOffset: offset });
  }, [setDepartureOffset, search]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <RealMap
        origin={input.origin}
        destination={input.destination}
        routes={routes}
        selectedId={selectedRouteId}
        recommendedId={recommendation?.recommended.id ?? null}
        currentLocation={currentLocation}
        onMapClick={handleMapClick}
      />

      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.brandRow}>
          <Text style={[styles.brand, { color: theme.text }]}>열을피자</Text>
          <Text style={[styles.brandEn, { color: theme.textSecondary }]}>HEATPIZZA</Text>
          {dataStatus !== 'idle' && dataStatus !== 'live' && (
            <View style={[styles.statusBadge, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                부분 데이터
              </Text>
            </View>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.panel, isMobile ? styles.panelBottom : styles.panelSide, { backgroundColor: theme.background }]}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.originRow}>
            <View style={styles.originInput}>
              <SearchInput
                icon="map-marker"
                placeholder="출발지 입력 (예: 을지로입구)"
                value={input.origin}
                onSelect={setOrigin}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.locBtn,
                { backgroundColor: locationStatus === 'ready' ? theme.accent : theme.backgroundElement },
              ]}
              onPress={handleUseCurrentLocation}
              disabled={locationStatus === 'locating'}
            >
              <MaterialCommunityIcons
                name={locationStatus === 'locating' ? 'crosshairs-gps' : locationStatus === 'ready' ? 'check' : 'crosshairs-gps'}
                size={16}
                color={locationStatus === 'ready' ? theme.accentText : theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {locationMessage && (
            <Text style={[styles.locMsg, { color: theme.textSecondary }]}>{locationMessage}</Text>
          )}

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <MaterialCommunityIcons name="dots-vertical" size={14} color={theme.textSecondary} />
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <SearchInput
            icon="map-marker-outline"
            placeholder="도착지 입력 (예: 강남역)"
            value={input.destination}
            onSelect={setDestination}
          />

          <View style={styles.timeRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>도착 희망</Text>
            <TouchableOpacity
              style={[styles.timeChip, { backgroundColor: theme.backgroundElement }]}
              onPress={() => setArrivalTime(shiftMinutes(kstNow(), 0))}
            >
              <Text style={[styles.timeChipText, { color: theme.text }]}>지금</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timeChip, { backgroundColor: theme.backgroundElement }]}
              onPress={() => setArrivalTime(shiftMinutes(kstNow(), 60))}
            >
              <Text style={[styles.timeChipText, { color: theme.text }]}>+1시간</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.searchBtn,
              { backgroundColor: input.origin && input.destination ? theme.accent : theme.backgroundElement },
            ]}
            onPress={handleSearch}
            disabled={!input.origin || !input.destination || isLoading}
          >
            {isLoading ? (
              <MaterialCommunityIcons name="loading" size={18} color={theme.textSecondary} />
            ) : (
              <MaterialCommunityIcons name="magnify" size={18} color={input.origin && input.destination ? theme.accentText : theme.textSecondary} />
            )}
            <Text
              style={[
                styles.searchBtnText,
                { color: input.origin && input.destination ? theme.accentText : theme.textSecondary },
              ]}>
              {isLoading ? '경로를 비교하고 있어요...' : '추천 받기'}
            </Text>
          </TouchableOpacity>

          {transitNote && (
            <View style={[styles.transitNote, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <MaterialCommunityIcons name="bus-alert" size={15} color={theme.textSecondary} />
              <Text style={[styles.transitNoteText, { color: theme.textSecondary }]}>{transitNote}</Text>
            </View>
          )}

          {error && (
            <View style={[styles.errorCard, { backgroundColor: theme.backgroundElement, borderLeftColor: theme.heat }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.heat} />
              <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
              <TouchableOpacity onPress={handleSearch}>
                <Text style={[styles.retryText, { color: theme.accent }]}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          )}

          {recommendation && (
            <ResultCard
              recommendation={recommendation}
              weather={weather}
              dataStatus={dataStatus}
              timings={timings}
              selectedRouteId={selectedRouteId}
              origin={input.origin}
              destination={input.destination}
              onSelectRoute={selectRoute}
              onDepartureShift={handleDepartureShift}
              onReset={reset}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  brandEn: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '600' },
  panel: {
    zIndex: 10,
    overflow: 'hidden',
  },
  panelSide: {
    position: 'absolute',
    top: 50,
    right: 0,
    bottom: 0,
    width: 380,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  panelBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '55%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  panelScroll: { flex: 1 },
  panelContent: { padding: 16, gap: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  originRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  originInput: { flex: 1 },
  locBtn: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locMsg: { fontSize: 11, paddingHorizontal: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeLabel: { fontSize: 12, fontWeight: '500' },
  timeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  timeChipText: { fontSize: 12, fontWeight: '600' },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  searchBtnText: { fontSize: 15, fontWeight: '700' },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  errorText: { flex: 1, fontSize: 13 },
  retryText: { fontSize: 13, fontWeight: '600' },
  transitNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  transitNoteText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
