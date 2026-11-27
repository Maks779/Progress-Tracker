import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { Check, CircleAlert, Info, type LucideIcon } from './icons';
import { Text } from './Text';

type Tone = 'success' | 'error' | 'info';

/** `icon` replaces the tone's icon, drawn in the text color (the lock of an expired session). */
type Props = { tone: Tone; title: string; message?: string; icon?: LucideIcon };

/** A short status card ("Reset link sent", a failed request). Screen readers announce it. */
export function Notice({ tone, title, message, icon }: Props) {
  const { colors, radius, space } = useTheme();
  const Icon = icon ?? { success: Check, error: CircleAlert, info: Info }[tone];
  const iconColor = icon
    ? colors.text.primary
    : {
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[8] }}>
        <View style={{ flexShrink: 0, paddingTop: 2 }}>
          <Icon color={iconColor} size={16} strokeWidth={2} />
        </View>
        <Text variant="smallStrong" style={{ flexShrink: 1 }}>
          {title}
        </Text>
      </View>
      {message ? (
        <Text variant="small" tone="muted">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
