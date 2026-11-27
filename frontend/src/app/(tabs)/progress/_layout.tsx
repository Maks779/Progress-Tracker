import { Stack } from 'expo-router';

import { useTheme } from '@/shared/theme/ThemeProvider';

/** Progress is a stack inside its tab: Records opens over the overview and keeps the tab bar. */
export const unstable_settings = { anchor: 'index' };

export default function ProgressLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }} />;
}
