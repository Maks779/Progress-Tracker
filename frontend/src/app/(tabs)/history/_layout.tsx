import { Stack } from 'expo-router';

import { useTheme } from '@/shared/theme/ThemeProvider';

/**
 * History is a stack inside its tab: a session, its edit page and the exercise picker open
 * over the month and keep the tab bar. The month is the anchor below any of them.
 */
export const unstable_settings = { anchor: 'index' };

export default function HistoryLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }} />;
}
