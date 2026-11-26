import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';
import { Check, type LucideIcon } from './icons';
import { Text } from './Text';

type ChipProps = { label: string; selected: boolean; icon?: LucideIcon; onPress: () => void };

/** Filter chip from the Figma library: an icon and a label; the selected one shows a check. */
export function Chip({ label, selected, icon: Icon, onPress }: ChipProps) {
  const { colors, radius } = useTheme();
  const Shown = selected ? Check : Icon;
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: 36,
        paddingHorizontal: 12,
        borderRadius: radius[8],
        borderWidth: 1,
        borderColor: selected || hovered ? colors.accent.fill : 'transparent',
        backgroundColor: selected ? colors.accent.subtle : colors.bg.surfaceRaised,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
        marginVertical: 4,
      })}
    >
      {Shown ? <Shown color={colors.accent.text} size={14} strokeWidth={2} /> : null}
      <Text variant="captionStrong">{label}</Text>
    </Pressable>
  );
}

type GroupProps<T extends string> = {
  label: string;
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
  /** One scrolling line (filters above a list) instead of wrapping lines (a choice in a form). */
  scroll?: boolean;
};

/** A choice of one among chips: a filter above a list, or a short choice in a form. */
export function ChipGroup<T extends string>({ label, options, value, onChange, scroll = false }: GroupProps<T>) {
  const { space } = useTheme();
  const chips = options.map((option) => (
    <Chip key={option.value} label={option.label} icon={option.icon} selected={option.value === value} onPress={() => onChange(option.value)} />
  ));
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        role="radiogroup"
        aria-label={label}
        contentContainerStyle={{ gap: space[8] }}
      >
        {chips}
      </ScrollView>
    );
  }
  return (
    <View style={{ gap: space[8] }}>
      <Text variant="smallStrong">{label}</Text>
      <View role="radiogroup" aria-label={label} style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[8] }}>
        {chips}
      </View>
    </View>
  );
}
