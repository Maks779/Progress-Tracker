import '@/shared/i18n';

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { installAuth, restoreSession } from '@/features/auth/session';
import { useAuthStore } from '@/features/auth/store';
import { useOnboardingGate } from '@/features/onboarding/useOnboardingGate';
import { hydratePreferences, usePreferences } from '@/features/settings/preferences';
import { usePreferencesSync } from '@/features/settings/usePreferencesSync';
import { createQueryClient, followAppFocus } from '@/shared/api/queryClient';
import { ThemeProvider, useTheme } from '@/shared/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();
installAuth();
followAppFocus();

/**
 * Signed-out people see the auth screens; a signed-in account without trackers goes through
 * onboarding first; everyone else gets the tabs. While the app checks for trackers it shows
 * a spinner, so Home never flashes before onboarding. On native the first allowed screen in
 * this order is the one that opens, so the order matters.
 */
function Navigator() {
  const { scheme, colors } = useTheme();
  const signedIn = useAuthStore((state) => state.status === 'signedIn');
  const expired = useAuthStore((state) => state.expired);
  const onboarding = useOnboardingGate();
  usePreferencesSync();

  if (signedIn && onboarding === 'unknown') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.base }}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={colors.accent.fill} />
      </View>
    );
  }

  const signedOutTarget = expired ? '/log-in' : '/welcome';
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }}
      >
        <Stack.Protected
          guard={signedIn && onboarding === 'done'}
          redirectTo={signedIn ? '/onboarding' : signedOutTarget}
        >
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected
          guard={signedIn && onboarding === 'needed'}
          redirectTo={signedIn ? '/' : signedOutTarget}
        >
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const status = useAuthStore((state) => state.status);
  const hydrated = usePreferences((state) => state.hydrated);
  const theme = usePreferences((state) => state.values.theme);
  const ready = (fontsLoaded || fontError !== null) && status !== 'restoring' && hydrated;

  useEffect(() => {
    hydratePreferences();
    restoreSession();
  }, []);

  useEffect(() => {
    if (status === 'signedOut') {
      queryClient.clear();
    }
  }, [status, queryClient]);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider preference={theme}>
        <Navigator />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
