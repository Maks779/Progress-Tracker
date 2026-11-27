import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Circle, CircleCheck } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import {
  colorFor,
  ICON_KEYS,
  TRACKER_COLORS,
  TRACKER_ICONS,
  type TrackerColor,
  type TrackerIcon,
  type TrackerType,
  TYPE_DEFAULTS,
} from '../catalog';

type TypeProps = { type: TrackerType; selected: boolean; onSelect: () => void };

/** One tracker type in step 1 of a new tracker: a card that works as a radio button. */
export function TypeCard({ type, selected, onSelect }: TypeProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const Icon = TRACKER_ICONS[TYPE_DEFAULTS[type].icon];
  const Mark = selected ? CircleCheck : Circle;
  const title = t(`trackers.types.${type}`);
  const body = t(`trackers.typeBodies.${type}`);
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      aria-label={`${title}, ${body}`}
      onPress={onSelect}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[16],
        minHeight: 72,
        paddingHorizontal: space[16],
        borderRadius: radius[12],
        borderWidth: 1,
        borderColor: selected ? colors.accent.fill : hovered ? colors.border.default : 'transparent',
        backgroundColor: selected ? colors.accent.subtle : colors.bg.surfaceRaised,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Icon color={selected ? colors.accent.text : colors.text.muted} size={24} strokeWidth={1.75} />
      <View style={{ flex: 1, paddingVertical: space[8] }}>
        <Text variant="smallMedium">{title}</Text>
        <Text variant="caption" tone="muted">
          {body}
        </Text>
      </View>
      <Mark color={colors.text.primary} size={22} strokeWidth={1.75} />
    </Pressable>
  );
}

type ColorProps = { value: TrackerColor; onChange: (color: TrackerColor) => void };

/** The four tracker colors as round swatches; the chosen one gets a ring. */
export function ColorPicker({ value, onChange }: ColorProps) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <View style={{ gap: space[16] }}>
      <Text variant="smallMedium">{t('trackers.fields.color')}</Text>
      <View role="radiogroup" aria-label={t('trackers.fields.color')} style={{ flexDirection: 'row', gap: space[16] }}>
        {TRACKER_COLORS.map((color) => {
          const selected = color === value;
          return (
            <Pressable
              key={color}
              role="radio"
              aria-checked={selected}
              aria-label={t(`trackers.colors.${color}`)}
              onPress={() => onChange(color)}
              style={({ focused }: { pressed: boolean; focused?: boolean }): ViewStyle => ({
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 24,
                borderWidth: 2,
                borderColor: selected ? colors.text.primary : colors.border.default,
                cursor: 'pointer',
                outlineStyle: 'solid',
                outlineWidth: showFocusRing(focused) ? 2 : 0,
                outlineColor: colors.accent.fill,
                outlineOffset: 2,
              })}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colorFor(colors, color) }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type IconProps = { value: TrackerIcon; color: TrackerColor; onChange: (icon: TrackerIcon) => void };

/** All 16 tracker icons in a grid of 48 px tiles, 4 a row on phones and 8 wider up; the chosen one is tinted in the tracker color. */
export function IconPicker({ value, color, onChange }: IconProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const compact = useBreakpoint() === 'compact';
  return (
    <View style={{ gap: space[16] }}>
      <Text variant="smallMedium">{t('trackers.fields.icon')}</Text>
      <View
        role="radiogroup"
        aria-label={t('trackers.fields.icon')}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[16], maxWidth: (compact ? 4 : 8) * 64 - space[16] }}
      >
        {ICON_KEYS.map((key) => {
          const selected = key === value;
          const Icon = TRACKER_ICONS[key];
          return (
            <Pressable
              key={key}
              role="radio"
              aria-checked={selected}
              aria-label={t(`trackers.icons.${key}`)}
              onPress={() => onChange(key)}
              style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius[12],
                borderWidth: 1,
                borderColor: selected ? colorFor(colors, color) : hovered ? colors.accent.fill : colors.border.default,
                backgroundColor: selected ? `${colorFor(colors, color)}26` : colors.bg.surfaceRaised,
                cursor: 'pointer',
                outlineStyle: 'solid',
                outlineWidth: showFocusRing(focused) ? 2 : 0,
                outlineColor: colors.accent.fill,
              })}
            >
              <Icon color={selected ? colorFor(colors, color) : colors.text.primary} size={24} strokeWidth={1.75} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
