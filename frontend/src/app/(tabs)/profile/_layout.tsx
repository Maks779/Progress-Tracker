import { Stack } from 'expo-router';

import { useTheme } from '@/shared/theme/ThemeProvider';

/** Profile is a stack inside its tab: Goals and Trackers open over it and keep the tab bar. */
export const unstable_settings = { initialRouteName: 'index' };

export default function ProfileLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }} />;
}
