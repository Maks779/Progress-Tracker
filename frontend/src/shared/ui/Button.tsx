import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'regular' | 'compact';
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  accessibilityHint?: string;
};

/** Buttons from the Figma library: 48 px regular, 44 px compact, keyboard focus ring on web. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'regular',
  disabled = false,
  loading = false,
  selected = false,
  accessibilityHint,
}: Props) {
  const { colors, radius, space } = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading, selected }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
        styles.base,
        {
          minHeight: controlHeight[size],
          borderRadius: radius[12],
          paddingHorizontal: space[16],
          backgroundColor: primary
            ? !inactive && (pressed || hovered)
              ? colors.accent.fillPressed
              : colors.accent.fill
            : variant === 'ghost'
              ? 'transparent'
              : selected
                ? colors.accent.subtle
                : colors.bg.surfaceRaised,
          borderColor:
            (!disabled && (focused || hovered)) || selected
              ? colors.accent.fill
              : colors.border.default,
          borderWidth: focused && !disabled ? 2 : primary ? 0 : 1,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed && !inactive ? 0.98 : 1 }],
          cursor: inactive ? 'auto' : 'pointer',
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.accent.onFill : colors.text.primary} />
      ) : (
        <Text variant="smallStrong" tone={primary ? 'onAccent' : 'primary'}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
