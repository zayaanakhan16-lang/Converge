import { tokens } from './tokens';

export type ThemeName = 'light' | 'dark';

/** Every colour the app is allowed to paint with, for one theme. */
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSunken: string;
  surfaceInverse: string;
  primary: string;
  primaryPressed: string;
  secondary: string;
  accent: string;
  accentSoft: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  onPrimary: string;
  onAccent: string;
  border: string;
  borderStrong: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const duration = {
  instant: 120,
  fast: 180,
  normal: 240,
  slow: 360,
} as const;

type TextStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform?: 'uppercase';
};

/**
 * Two typefaces, each doing one job.
 *
 * Plus Jakarta Sans carries display and titles: geometric, slightly
 * humanist, and distinctive at large sizes without becoming decorative.
 * Inter carries body, captions and message text, where its larger x-height
 * and open apertures hold up at 13-15px on a low-density phone screen.
 *
 * Inter is also used for numerals that need to line up (timestamps, counts),
 * because its figures are tabular by default.
 */
const jakarta = {
  regular: 'Jakarta-Regular',
  medium: 'Jakarta-Medium',
  semibold: 'Jakarta-SemiBold',
  bold: 'Jakarta-Bold',
  extrabold: 'Jakarta-ExtraBold',
} as const;

const inter = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

/**
 * Type scale.
 *
 * Display and titles are Plus Jakarta Sans with tightened tracking; body and
 * below are Inter. Line heights are set for reading comfort rather than
 * mathematical consistency, which is why they are not a single ratio.
 */
export const typography = {
  display: {
    fontFamily: jakarta.extrabold,
    fontSize: 33,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  title1: {
    fontFamily: jakarta.bold,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  title2: {
    fontFamily: jakarta.bold,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  title3: {
    fontFamily: jakarta.semibold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: inter.regular,
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: 0,
  },
  bodyStrong: {
    fontFamily: inter.semibold,
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: inter.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  label: {
    fontFamily: jakarta.bold,
    fontSize: 11.5,
    lineHeight: 16,
    letterSpacing: 0.9,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontFamily: jakarta.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  mono: {
    fontFamily: inter.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;

export interface Theme {
  name: ThemeName;
  colors: ThemeColors;
  /** Elevation is expressed as a shadow; dark themes use borders instead. */
  elevation: {
    none: object;
    low: object;
    medium: object;
  };
  statusBar: 'light' | 'dark';
}

const shadow = (opacity: number, radius: number, offsetY: number, elevation: number) => ({
  shadowColor: '#0B1420',
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: offsetY },
  elevation,
});

export const lightTheme: Theme = {
  name: 'light',
  colors: tokens.themes.light as unknown as ThemeColors,
  elevation: {
    none: {},
    low: shadow(0.06, 6, 1, 1),
    medium: shadow(0.1, 14, 4, 4),
  },
  statusBar: 'dark',
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: tokens.themes.dark as unknown as ThemeColors,
  elevation: {
    none: {},
    low: shadow(0.4, 6, 1, 0),
    medium: shadow(0.5, 14, 4, 0),
  },
  statusBar: 'light',
};

export const themes: Record<ThemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

/** Minimum touch target required for interactive elements. */
export const MIN_TOUCH_TARGET = 48;
