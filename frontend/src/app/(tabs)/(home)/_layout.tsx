import { Stack } from 'expo-router';

import { useTheme } from '@/shared/theme/ThemeProvider';

/**
 * Home is a stack inside its tab: the workout, its exercise picker and its summary open over
 * Home and keep the tab bar, as in the design. Home is the anchor below any of them.
 */
export const unstable_settings = { anchor: 'index' };

export default function HomeLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }} />;
}
