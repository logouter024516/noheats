/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111318',
    background: '#FFFFFF',
    backgroundElement: '#F4F5F7',
    backgroundSelected: '#E8EAEE',
    textSecondary: '#5D6470',
    accent: '#2563EB',
    accentText: '#FFFFFF',
    heat: '#DC2626',
    heatMild: '#F59E0B',
    border: '#D9DDE3',
    surfaceElevated: '#FFFFFF',
    onAccent: '#FFFFFF',
    mapSurface: '#E6EBF0',
    mapRoad: '#FFFFFF',
    mapRoadMajor: '#F8FAFB',
    mapWater: '#AFCBE4',
    mapPark: '#D7E8D4',
    mapLabel: '#7A8494',
    mapRouteAlt: '#9AA3B0',
    mapDot: '#FFFFFF',
  },
  dark: {
    text: '#ECEEF1',
    background: '#0F1216',
    backgroundElement: '#181C21',
    backgroundSelected: '#22272E',
    textSecondary: '#9AA3AD',
    accent: '#3B82F6',
    accentText: '#0B0E11',
    heat: '#EF4444',
    heatMild: '#FBBF24',
    border: '#2E333A',
    surfaceElevated: '#1B2026',
    onAccent: '#FFFFFF',
    mapSurface: '#10151A',
    mapRoad: '#1A2128',
    mapRoadMajor: '#232B33',
    mapWater: '#1E3A52',
    mapPark: '#1F2E1F',
    mapLabel: '#6E7885',
    mapRouteAlt: '#4A5563',
    mapDot: '#0F1216',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
