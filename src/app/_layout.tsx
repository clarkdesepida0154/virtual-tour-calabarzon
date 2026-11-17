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
import { IdentityProvider, useIdentity } from '@/context/IdentityContext';
import { ToastProvider } from '@/context/ToastContext';
import { colors, navigationTheme, paperTheme } from '@/theme';

// Keep the splash screen up until the fonts and the saved session are ready,
// so text never flashes in a fallback typeface and Welcome never flickers.
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
  if (!fontsReady) return null;

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navigationTheme}>
        <DataSyncProvider>
          <IdentityProvider>
            <ExploreFiltersProvider>
              <ToastProvider>
                <RootNavigator />
                <StatusBar style="dark" />
              </ToastProvider>
            </ExploreFiltersProvider>
          </IdentityProvider>
        </DataSyncProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}

/**
 * The root stack. Without a session and before "Continue as guest", only the
 * Welcome flow is reachable; afterwards the whole app is. Guests and
 * signed-in users see exactly the same features.
 */
function RootNavigator() {
  const { isReady, needsWelcome } = useIdentity();

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
      <Stack.Protected guard={needsWelcome}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      </Stack.Protected>

      <Stack.Protected guard={!needsWelcome}>
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
      </Stack.Protected>

      {/* Reachable from Welcome and, for guests, from the Progress tab. */}
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
