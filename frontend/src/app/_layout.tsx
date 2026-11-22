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

import { installAuth, restoreSession } from '@/features/auth/session';
import { useAuthStore } from '@/features/auth/store';
import { createQueryClient } from '@/shared/api/queryClient';
import { ThemeProvider, useTheme } from '@/shared/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();
installAuth();

function Navigator() {
  const { scheme, colors } = useTheme();
  const signedIn = useAuthStore((state) => state.status === 'signedIn');
  const expired = useAuthStore((state) => state.expired);
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }}
      >
        <Stack.Protected guard={signedIn} redirectTo={expired ? '/log-in' : '/welcome'}>
          <Stack.Screen name="(tabs)" />
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
  const ready = (fontsLoaded || fontError !== null) && status !== 'restoring';

  useEffect(() => {
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
      <ThemeProvider>
        <Navigator />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
