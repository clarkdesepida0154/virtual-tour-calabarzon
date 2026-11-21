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
import { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';

import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { DataSyncProvider } from '@/context/DataSyncContext';
import { ExploreFiltersProvider } from '@/context/ExploreFiltersContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { I18nProvider } from '@/context/I18nContext';
import { IdentityProvider, useIdentity } from '@/context/IdentityContext';
import { LocationProvider } from '@/context/LocationContext';
import { PreferencesProvider, usePreferences } from '@/context/PreferencesContext';
import { ToastProvider } from '@/context/ToastContext';
import { AppThemeProvider, useAppTheme } from '@/theme/ThemeProvider';

// Keep the splash screen up until the fonts, the saved settings (theme,
// language) and the saved session are ready, so text never flashes in a
// fallback typeface, the wrong theme or language, and Welcome never flickers.
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

  // If the fonts fail to load the app still opens, using system fonts.
  const fontsReady = fontsLoaded || fontError !== null;

  return (
    <PreferencesProvider>
      <AppThemeProvider>
        <I18nProvider>{fontsReady ? <ThemedApp /> : null}</I18nProvider>
      </AppThemeProvider>
    </PreferencesProvider>
  );
}

/** Everything below the theme: drawn only once the saved settings are known. */
function ThemedApp() {
  const theme = useAppTheme();
  const { isReady } = usePreferences();
  if (!isReady) return null;

  return (
    <PaperProvider theme={theme.paper}>
      <ThemeProvider value={theme.navigation}>
        <DataSyncProvider>
          <IdentityProvider>
            <LocationProvider>
              <ExploreFiltersProvider>
                <ToastProvider>
                  <FavoritesProvider>
                    <RootNavigator />
                    <ThemedStatusBar />
                  </FavoritesProvider>
                </ToastProvider>
              </ExploreFiltersProvider>
            </LocationProvider>
          </IdentityProvider>
        </DataSyncProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}

/**
 * The root stack. On a true first launch only the onboarding carousel is
 * reachable; then, without a session and before "Continue as guest", only
 * the Welcome flow; afterwards the whole app. Guests and signed-in users see
 * exactly the same features.
 */
function RootNavigator() {
  const { colors } = useAppTheme();
  const { isReady, needsWelcome, needsOnboarding } = useIdentity();
  const showWelcome = needsWelcome && !needsOnboarding;
  const showApp = !needsWelcome && !needsOnboarding;

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Protected guard={needsOnboarding} redirectTo={needsWelcome ? '/welcome' : '/'}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>

      <Stack.Protected guard={showWelcome} redirectTo={needsOnboarding ? '/onboarding' : '/'}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      </Stack.Protected>

      {/* Without a session or a guest choice, every app screen redirects to Welcome. */}
      <Stack.Protected guard={showApp} redirectTo={needsOnboarding ? '/onboarding' : '/welcome'}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="destination/[id]/index" />
        <Stack.Screen name="destination/[id]/edit" />
        <Stack.Screen
          name="destination/[id]/tour"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
            contentStyle: { backgroundColor: colors.exhibit },
          }}
        />
        <Stack.Screen
          name="destination/[id]/quiz"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="add" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="credits" />
      </Stack.Protected>

      {/* Reachable from Welcome and, for guests, from the Progress tab. */}
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
