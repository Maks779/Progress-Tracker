import { type ReactNode, type Ref, useState } from 'react';
import { TextInput, type TextInputInstance, type TextInputProps, View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';

import { Check, CircleAlert } from './icons';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  hint?: string;
  hintMet?: boolean;
  error?: string;
  footer?: ReactNode;
  ref?: Ref<TextInputInstance>;
};

/**
 * Input field from the Figma library: a label, a 48 px field with an accent border on focus,
 * and below it either a hint (green with a check once `hintMet`) or an error with the alert icon.
 */
export function TextField({
  label,
  hint,
  hintMet = false,
  error,
  footer,
  ref,
  onFocus,
  onBlur,
  ...input
}: Props) {
  const { colors, radius, space, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.state.error
    : focused
      ? colors.accent.fill
      : colors.border.default;

  return (
    <View style={{ gap: space[8] }}>
      <Text variant="smallStrong">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.text.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={{
          fontFamily: typography.body.fontFamily,
          fontSize: typography.body.fontSize,
          minHeight: controlHeight.regular,
          paddingHorizontal: space[16],
          borderRadius: radius[12],
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.bg.surfaceRaised,
          color: colors.text.primary,
          outlineStyle: 'solid',
          outlineWidth: focused ? 1 : 0,
          outlineColor: borderColor,
        }}
        {...input}
      />
      {error ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}
        >
          <CircleAlert color={colors.state.error} size={16} strokeWidth={2} />
          <Text variant="caption" style={{ flexShrink: 1 }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
          {hintMet ? <Check color={colors.state.success} size={14} strokeWidth={2.5} /> : null}
          <Text variant="caption" tone={hintMet ? 'success' : 'muted'} style={{ flexShrink: 1 }}>
            {hint}
          </Text>
        </View>
      ) : null}
      {footer}
    </View>
  );
}
