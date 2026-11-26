import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Segmented control from the Figma library: 2–4 options in a 44 px track, the chosen one on a
 * raised tile, labels at 12 px as in the design so three fit on a phone. Screen readers get a
 * radio group named by `label`.
 */
export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      role="radiogroup"
      aria-label={label}
      style={{
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: radius[12],
        backgroundColor: colors.bg.surfaceRaised,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-label={option.label}
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
              flex: 1,
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space[8],
              borderRadius: radius[8],
              borderWidth: 1,
              borderColor: selected ? colors.border.default : 'transparent',
              backgroundColor: selected ? colors.bg.surface : hovered ? colors.bg.base : 'transparent',
              cursor: selected ? 'auto' : 'pointer',
              outlineStyle: 'solid',
              outlineWidth: showFocusRing(focused) ? 2 : 0,
              outlineColor: colors.accent.fill,
            })}
          >
            <Text variant={selected ? 'captionStrong' : 'caption'} tone={selected ? 'primary' : 'muted'} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
