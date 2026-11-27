import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';
import { type LucideIcon, Minus, Plus } from './icons';
import { Text } from './Text';

type StepButtonProps = { label: string; icon: LucideIcon; disabled: boolean; onPress: () => void };

function StepButton({ label, icon: Icon, disabled, onPress }: StepButtonProps) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius[12],
        borderWidth: 1,
        borderColor: hovered && !disabled ? colors.accent.fill : colors.border.default,
        backgroundColor: colors.bg.surfaceRaised,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'auto' : 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Icon color={colors.text.primary} size={20} strokeWidth={2} />
    </Pressable>
  );
}

type Props = {
  value: number;
  unit: string;
  canDecrease: boolean;
  canIncrease: boolean;
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (direction: 1 | -1) => void;
};

/**
 * Number stepper from the Figma library: − / value / + with the unit under the value
 * ("3" over "sessions / week"). Screen readers hear the new value after each step.
 */
export function Stepper({ value, unit, canDecrease, canIncrease, decreaseLabel, increaseLabel, onChange }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <StepButton label={decreaseLabel} icon={Minus} disabled={!canDecrease} onPress={() => onChange(-1)} />
      <View style={{ alignItems: 'center', flexShrink: 1 }} aria-live="polite">
        <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
        <Text variant="small" tone="muted" style={{ textAlign: 'center', marginTop: 8 }}>
          {unit}
        </Text>
      </View>
      <StepButton label={increaseLabel} icon={Plus} disabled={!canIncrease} onPress={() => onChange(1)} />
    </View>
  );
}
