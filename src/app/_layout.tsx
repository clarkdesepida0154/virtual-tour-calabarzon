import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display/400Regular_Italic';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';

import { DataSyncProvider } from '@/context/DataSyncContext';
import { ExploreFiltersProvider } from '@/context/ExploreFiltersContext';
import { ToastProvider } from '@/context/ToastContext';
import { colors, navigationTheme, paperTheme } from '@/theme';

// Keep the splash screen up until the fonts are ready, so text never flashes
// in a fallback typeface.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // The keys below are the font family names used in src/theme.
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    ...MaterialCommunityIcons.font,
  });

  const isReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  // If the fonts fail to load the app still opens, using system fonts.
  if (!isReady) return null;

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navigationTheme}>
        <DataSyncProvider>
          <ExploreFiltersProvider>
            <ToastProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="destination/[id]/index" />
                <Stack.Screen name="destination/[id]/edit" />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="dark" />
            </ToastProvider>
          </ExploreFiltersProvider>
        </DataSyncProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}
