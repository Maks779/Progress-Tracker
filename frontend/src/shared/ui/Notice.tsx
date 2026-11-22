import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { Check, CircleAlert, Info } from './icons';
import { Text } from './Text';

type Tone = 'success' | 'error' | 'info';

type Props = { tone: Tone; title: string; message?: string };

/** A short status card ("Reset link sent", a failed request). Screen readers announce it. */
export function Notice({ tone, title, message }: Props) {
  const { colors, radius, space } = useTheme();
  const Icon = { success: Check, error: CircleAlert, info: Info }[tone];
  const iconColor = {
    success: colors.state.success,
    error: colors.state.error,
    info: colors.accent.text,
  }[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        backgroundColor: colors.bg.surface,
        borderColor: tone === 'error' ? colors.state.error : colors.border.default,
        borderWidth: 1,
        borderRadius: radius[16],
        padding: space[16],
        gap: space[8],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <Icon color={iconColor} size={16} strokeWidth={2} />
        <Text variant="smallStrong" style={{ flexShrink: 1 }}>
          {title}
        </Text>
      </View>
      {message ? (
        <Text variant="caption" tone="muted">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
