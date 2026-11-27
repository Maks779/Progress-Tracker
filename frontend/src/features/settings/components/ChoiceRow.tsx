import { Fragment } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Check } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * One setting with every choice in sight ("kg ✓ / lb"): one tap changes it. Screen readers
 * get a radio group. On phones the choices always sit under the label, so every row looks
 * the same in every language; wider screens keep both on one line and wrap only if needed.
 */
export function ChoiceRow<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors, radius, space } = useTheme();
  const stacked = useBreakpoint() === 'compact';
  return (
    <View
      style={
        stacked
          ? { paddingTop: space[8] }
          : {
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              columnGap: space[16],
              minHeight: 44,
            }
      }
    >
      <Text variant="small">{label}</Text>
      <View
        role="radiogroup"
        aria-label={label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginHorizontal: -space[8],
        }}
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <Fragment key={option.value}>
              {index > 0 ? (
                <Text variant="caption" tone="muted" accessibilityElementsHidden importantForAccessibility="no">
                  /
                </Text>
              ) : null}
              <Pressable
                role="radio"
                aria-label={option.label}
                aria-checked={selected}
                onPress={() => onChange(option.value)}
                style={({ focused }: { pressed: boolean; focused?: boolean }): ViewStyle => ({
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: space[8],
                  borderRadius: radius[8],
                  cursor: selected ? 'auto' : 'pointer',
                  outlineStyle: 'solid',
                  outlineWidth: showFocusRing(focused) ? 2 : 0,
                  outlineColor: colors.accent.fill,
                })}
              >
                {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
                  <>
                    <Text
                      variant={selected ? 'captionStrong' : 'caption'}
                      tone={selected ? 'primary' : 'muted'}
                      style={{ textDecorationLine: hovered && !selected ? 'underline' : 'none' }}
                    >
                      {option.label}
                    </Text>
                    {selected ? <Check color={colors.text.primary} size={12} strokeWidth={2.5} /> : null}
                  </>
                )}
              </Pressable>
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}
