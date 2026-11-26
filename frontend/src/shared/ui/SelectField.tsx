import { useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';

import { showFocusRing } from './focusRing';
import { Check, ChevronDown } from './icons';
import { Sheet } from './Sheet';
import { Text } from './Text';

export type SelectOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * The "select" input from the Figma library: a field with the current choice and a chevron.
 * Tapping it opens a sheet with every option; choosing one closes the sheet.
 */
export function SelectField<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors, radius, space, typography } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);

  return (
    <View style={{ gap: space[8] }}>
      <Text variant="smallStrong">{label}</Text>
      <Pressable
        role="button"
        aria-label={`${label}: ${current?.label ?? ''}`}
        aria-haspopup="dialog"
        onPress={() => setOpen(true)}
        style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[8],
          minHeight: controlHeight.regular,
          paddingHorizontal: space[16],
          borderRadius: radius[12],
          borderWidth: 1,
          borderColor: hovered ? colors.accent.fill : colors.border.default,
          backgroundColor: colors.bg.surfaceRaised,
          cursor: 'pointer',
          outlineStyle: 'solid',
          outlineWidth: showFocusRing(focused) ? 2 : 0,
          outlineColor: colors.accent.fill,
        })}
      >
        <Text style={{ flex: 1, fontSize: typography.body.fontSize }} numberOfLines={1}>
          {current?.label ?? ''}
        </Text>
        <ChevronDown color={colors.text.muted} size={20} strokeWidth={1.75} />
      </Pressable>
      {open ? (
        <Sheet visible title={label} onClose={() => setOpen(false)}>
          <View role="radiogroup" aria-label={label}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  role="radio"
                  aria-label={option.label}
                  aria-checked={selected}
                  onPress={() => {
                    setOpen(false);
                    onChange(option.value);
                  }}
                  style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[16],
                    minHeight: 56,
                    paddingHorizontal: space[8],
                    borderRadius: radius[12],
                    backgroundColor: selected ? colors.accent.subtle : hovered ? colors.bg.surfaceRaised : 'transparent',
                    cursor: 'pointer',
                    outlineStyle: 'solid',
                    outlineWidth: showFocusRing(focused) ? 2 : 0,
                    outlineColor: colors.accent.fill,
                  })}
                >
                  <Text variant={selected ? 'bodyStrong' : 'body'} style={{ flex: 1 }}>
                    {option.label}
                  </Text>
                  {selected ? <Check color={colors.accent.text} size={20} strokeWidth={2} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}
