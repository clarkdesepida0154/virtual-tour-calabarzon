import * as SystemUI from 'expo-system-ui';
import { createContext, use, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

import { usePreferences } from '@/context/PreferencesContext';
import { resolveScheme } from '@/lib/preferences';
import { THEMES } from '@/theme';
import type { AppTheme } from '@/theme';

const ThemeContext = createContext<AppTheme>(THEMES.light);

/**
 * Applies the Light / Dark / System setting app-wide. Switching swaps the
 * whole token set at once; every `makeStyles` hook and `useAppTheme()` reader
 * re-renders with the new colours (no restart, navigation state kept).
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const system = useColorScheme();
  const theme = THEMES[resolveScheme(preferences.theme, system)];

  // The window background behind the (edge-to-edge) system bars and during
  // screen transitions follows the theme, so nothing flashes cream in dark mode.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [theme]);

  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

/** The active theme: colours, shadows, map style, Paper / navigation themes. */
export function useAppTheme(): AppTheme {
  return use(ThemeContext);
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Theme-aware styles. Declare once per file, call the returned hook inside
 * each component:
 *
 *   const useStyles = makeStyles(({ colors, elevation }) => ({ card: { backgroundColor: colors.surface } }));
 *   function Card() { const styles = useStyles(); … }
 *
 * The style sheet is built once per theme and cached, so switching themes is
 * cheap and re-renders never rebuild it.
 */
// Same signature as StyleSheet.create.
export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(factory: (theme: AppTheme) => T & NamedStyles<any>) {
  const cache = new WeakMap<AppTheme, T>();
  return function useStyles(): T {
    const theme = useAppTheme();
    return useMemo(() => {
      let sheet = cache.get(theme);
      if (!sheet) {
        sheet = StyleSheet.create(factory(theme));
        cache.set(theme, sheet);
      }
      return sheet;
    }, [theme]);
  };
}
