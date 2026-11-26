import { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';

import { showFocusRing } from './focusRing';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = {
  label: string;
  onPress: () => unknown;
  variant?: ButtonVariant;
  size?: 'regular' | 'compact';
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  accessibilityHint?: string;
};

/**
 * Buttons from the Figma library: 48 px regular, 44 px compact, keyboard focus ring on web.
 * When `onPress` returns a promise, taps are ignored until it settles: the button greys out
 * only after the next render, and a second tap in the same frame would run the action again.
 */
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
  const running = useRef(false);

  const press = () => {
    if (running.current) {
      return;
    }
    const result = onPress();
    if (result instanceof Promise) {
      running.current = true;
      const release = () => {
        running.current = false;
      };
      result.then(release, (error: unknown) => {
        release();
        throw error;
      });
    }
  };
  return (
    <Pressable
      role="button"
      aria-label={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={inactive}
      aria-busy={loading}
      aria-selected={selected}
      disabled={inactive}
      onPress={press}
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
            (!disabled && (showFocusRing(focused) || hovered)) || selected
              ? colors.accent.fill
              : colors.border.default,
          borderWidth: showFocusRing(focused) && !disabled ? 2 : primary ? 0 : 1,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed && !inactive ? 0.98 : 1 }],
          cursor: inactive ? 'auto' : 'pointer',
          outlineStyle: 'solid',
          outlineWidth: 0,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.accent.onFill : colors.text.primary} />
      ) : (
        <Text variant="smallStrong" tone={primary ? 'onAccent' : 'primary'} style={{ textAlign: 'center' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
