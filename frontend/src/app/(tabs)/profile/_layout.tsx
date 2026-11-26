import { Stack } from 'expo-router';

import { useTheme } from '@/shared/theme/ThemeProvider';

/**
 * Profile is a stack inside its tab: Goals and Trackers open over it and keep the tab bar.
 * Profile is the anchor: a page opened straight from a link or a reload still has it below.
 */
export const unstable_settings = { anchor: 'index' };

export default function ProfileLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }} />;
}
