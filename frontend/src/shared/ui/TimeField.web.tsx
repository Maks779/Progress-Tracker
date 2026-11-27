import { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';

import { Text } from './Text';
import type { TimeFieldProps } from './TimeField';

/** The web time input: the browser's own `<input type="time">`, with its keyboard entry. */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const { colors, radius, scheme, space, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? colors.accent.fill : colors.border.default;

  return (
    <View style={{ gap: space[8] }}>
      <Text variant="smallMedium">{label}</Text>
      <input
        type="time"
        aria-label={label}
        value={value}
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
    </View>
  );
}
