import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';

type Props = { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean };

/**
 * The toggle from the Figma library (off, on; 48 × 28): the track turns accent when on and the
 * knob moves across. A 44 px touch target; screen readers hear a switch named by `label`.
 */
export function Toggle({ label, value, onChange, disabled = false }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      role="switch"
      aria-label={label}
      aria-checked={value}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={({ focused }: { pressed: boolean; focused?: boolean }): ViewStyle => ({
        width: 48,
        height: 28,
        borderRadius: 14,
        padding: 3,
        justifyContent: 'center',
        alignItems: value ? 'flex-end' : 'flex-start',
        backgroundColor: value ? colors.accent.fill : colors.bg.surfaceRaised,
        borderWidth: value ? 0 : 1,
        borderColor: colors.border.default,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'auto' : 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
        outlineOffset: 2,
      })}
    >
      <View
        style={{
          width: value ? 22 : 20,
          height: value ? 22 : 20,
          borderRadius: 11,
          backgroundColor: value ? colors.accent.onFill : colors.text.muted,
        }}
      />
    </Pressable>
  );
}
