import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme, type ThemeName } from '../theme';

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  /** Follows the device setting by default; users can override in Settings. */
  preference: ThemeName | 'system';
  setPreference(next: ThemeName | 'system'): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemeName | 'system'>('system');

  const themeName: ThemeName =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: themeName === 'dark' ? darkTheme : lightTheme,
      themeName,
      preference,
      setPreference,
    }),
    [themeName, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
