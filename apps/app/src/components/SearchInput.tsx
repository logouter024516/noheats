import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { searchPlaces } from '../adapters/geocoding';
import { Place } from '../domain/types';
import { useTheme } from '../hooks/use-theme';

type Props = {
  icon: 'map-marker' | 'map-marker-outline';
  placeholder: string;
  value: Place | null;
  onSelect: (place: Place) => void;
};

export function SearchInput({ icon, placeholder, value, onSelect }: Props) {
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const theme = useTheme();

  useEffect(() => {
    if (value) setQuery(value.label);
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query === value?.label) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(query);
        setResults(places);
        setShowDropdown(places.length > 0);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, value]);

  const handleSelect = useCallback((place: Place) => {
    setQuery(place.label);
    setShowDropdown(false);
    setResults([]);
    onSelect(place);
    Keyboard.dismiss();
  }, [onSelect]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputRow, { backgroundColor: theme.backgroundElement }]}>
        <MaterialCommunityIcons name={icon} size={18} color={theme.accent} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          returnKeyType="search"
          autoCorrect={false}
          onSubmitEditing={() => {
            if (results.length > 0) handleSelect(results[0]);
          }}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
            <MaterialCommunityIcons name="close-circle" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {showDropdown && results.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          {results.map((item, i) => (
            <TouchableOpacity
              key={`${item.label}-${i}`}
              style={[styles.resultItem, { borderBottomColor: theme.border }]}
              onPress={() => handleSelect(item)}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={14} color={theme.textSecondary} />
              <View style={styles.resultBody}>
                <Text style={[styles.resultText, { color: theme.text }]}>{item.label}</Text>
                {item.subLabel ? (
                  <Text style={[styles.resultSub, { color: theme.textSecondary }]}>{item.subLabel}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {value?.subLabel && !showDropdown && (
        <Text style={[styles.selectedSub, { color: theme.textSecondary }]}>
          {value.subLabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  dropdown: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultBody: { flex: 1, gap: 1 },
  resultText: { fontSize: 14, fontWeight: '500' },
  resultSub: { fontSize: 11 },
  selectedSub: { fontSize: 11, paddingTop: 4, paddingHorizontal: 4 },
});
