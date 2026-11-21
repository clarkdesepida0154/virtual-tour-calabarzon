import { StatusBar } from 'expo-status-bar';

import { useAppTheme } from '@/theme/ThemeProvider';

/**
 * The status bar for the current screen. By default its icons contrast with
 * the theme's page background (dark icons on cream, light icons on the dark
 * theme). Pass `overDark` where the top of the screen is a photo, the hero
 * band or the exhibit wall — there the icons are always light.
 */
export function ThemedStatusBar({ overDark = false }: { overDark?: boolean }) {
  const { statusBarStyle } = useAppTheme();
  return <StatusBar style={overDark ? 'light' : statusBarStyle} />;
}
