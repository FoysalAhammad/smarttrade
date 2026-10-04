import { Platform } from 'react-native';

export const colors = {
  brand: {
    primary: '#4C8DFF',
    secondary: '#00D9FF',
    accent: '#F7B733',
  },
  bg: {
    screen: '#0B0E11',
    card: '#151A21',
    elevated: '#1E2329',
    input: '#0E1217',
    pulse: 'rgba(14,203,129,0.12)',
  },
  border: {
    subtle: '#232A33',
    strong: '#2E3742',
  },
  text: {
    primary: '#EAECEF',
    secondary: '#A7B0BA',
    tertiary: '#7A8390',
    inverse: '#0B0E11',
    onAccent: '#04111F',
  },
  feedback: {
    success: '#0ECB81',
    successDim: 'rgba(14,203,129,0.14)',
    danger: '#F6465D',
    dangerDim: 'rgba(246,70,93,0.14)',
    warning: '#F0B90B',
    warningDim: 'rgba(240,185,11,0.14)',
    info: '#4C8DFF',
    infoDim: 'rgba(76,141,255,0.14)',
  },
  overlay: 'rgba(0,0,0,0.72)',
  live: '#0ECB81',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  xxxl: 34,
  display: 44,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

const monoFont = Platform.select({
  android: 'monospace',
  ios: 'Menlo',
  default: 'monospace',
});

export const fontFamily = {
  mono: monoFont as string,
  sans: Platform.select({
    android: 'sans-serif',
    default: 'System',
  }) as string,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

export const shadows = {
  card: Platform.select({
    android: { elevation: 3 },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
  }) as object,
  float: Platform.select({
    android: { elevation: 8 },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
  }) as object,
} as const;

export const tokens = { colors, spacing, fontSize, fontWeight, fontFamily, radius, shadows };

export type Tokens = typeof tokens;
