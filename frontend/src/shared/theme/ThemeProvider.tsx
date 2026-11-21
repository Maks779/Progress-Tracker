import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { type Palette, palettes, radius, space, typography } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

type ThemeValue = {
  scheme: ColorScheme;
  colors: Palette;
  space: typeof space;
  radius: typeof radius;
  typography: typeof typography;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function resolveScheme(
  preference: ThemePreference,
  system: ColorScheme | null | undefined,
): ColorScheme {
  if (preference !== 'system') {
    return preference;
  }
  return system === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const value = useMemo<ThemeValue>(() => {
    const scheme = resolveScheme(preference, system);
    return {
      scheme,
      colors: palettes[scheme],
      space,
      radius,
      typography,
      preference,
      setPreference,
    };
  }, [preference, system]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return theme;
}
