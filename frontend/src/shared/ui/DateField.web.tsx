import { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';

import type { DateFieldProps } from './DateField';
import { Text } from './Text';

/**
 * The web date input: the browser's own `<input type="date">`, which brings the calendar
 * popup, keyboard entry and the screen-reader support of the browser.
 */
export function DateField({ label, value, minimum, maximum, error, onChange }: DateFieldProps) {
  const { colors, radius, scheme, space, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.state.error : focused ? colors.accent.fill : colors.border.default;

  return (
    <View style={{ gap: space[8] }}>
      <Text variant="smallMedium">{label}</Text>
      <input
        type="date"
        aria-label={label}
        value={value}
        min={minimum}
        max={maximum}
        required
        onChange={(event) => event.target.value && onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          height: controlHeight.regular,
          padding: `0 ${space[16]}px`,
          borderRadius: radius[12],
          border: `1px solid ${borderColor}`,
          outline: focused ? `1px solid ${borderColor}` : 'none',
          backgroundColor: colors.bg.surfaceRaised,
          color: colors.text.primary,
          fontFamily: typography.body.fontFamily,
          fontSize: typography.body.fontSize,
          colorScheme: scheme,
        }}
      />
      {error ? (
        <Text variant="caption" tone="error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
