import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { colorFor, TYPE_DEFAULTS } from '@/features/trackers/catalog';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Card } from '@/shared/ui/Card';
import { showFocusRing } from '@/shared/ui/focusRing';
import { ChevronLeft, ChevronRight } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';
import { Text } from '@/shared/ui/Text';

import { useHistoryText } from '../format';
import { monthGrid, type TrackerType, TYPE_ORDER } from '../rules';

const MARK = 6;

/** A calendar marker: ● strength, ◆ cardio, ■ reading, + general (design §2.5: shape and color, never color alone). */
export function TypeMark({ type, color, size = MARK }: { type: TrackerType; color: string; size?: number }) {
  if (type === 'general') {
    const bar = Math.max(1.5, size / 4);
    return (
      <View style={{ width: size + 1, height: size + 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: size + 1, height: bar, backgroundColor: color }} />
        <View style={{ position: 'absolute', width: bar, height: size + 1, backgroundColor: color }} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: type === 'cardio' ? size * 0.85 : size,
        height: type === 'cardio' ? size * 0.85 : size,
        borderRadius: type === 'strength' ? size / 2 : type === 'reading' ? 1 : 0,
        backgroundColor: color,
        transform: type === 'cardio' ? [{ rotate: '45deg' }] : undefined,
      }}
    />
  );
}

type Props = {
  month: string;
  today: string;
  selected: string;
  days: Map<string, TrackerType[]>;
  onMonth: (by: number) => void;
  onSelect: (date: string) => void;
};

/**
 * The month (design: History / Month): the month and its arrows, the weekdays from Monday, a
 * cell per day with a marker per tracker type logged that day, and the legend. The chosen day
 * is outlined; days after today cannot be chosen, and neither can months after this one.
 */
export function MonthCalendar({ month, today, selected, days, onMonth, onSelect }: Props) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const text = useHistoryText();
  const current = month >= today.slice(0, 7);
  const typeNames = (types: TrackerType[]) => types.map((type) => t(`history.types.${type}`)).join(', ');

  return (
    <Card style={{ padding: wide ? space[24] : space[16], gap: space[8] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <Text variant="h3" accessibilityRole="header" style={{ flex: 1 }}>
          {text.monthTitle(month)}
        </Text>
        <View style={{ flexDirection: 'row', marginRight: -10 }}>
          <IconButton icon={ChevronLeft} label={t('history.calendar.previous')} onPress={() => onMonth(-1)} />
          <IconButton icon={ChevronRight} label={t('history.calendar.next')} onPress={() => onMonth(1)} disabled={current} />
        </View>
      </View>
      <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants" aria-hidden>
        {text.weekdays().map((day, index) => (
          <Text key={index} variant="caption" tone="muted" style={{ flex: 1, textAlign: 'center' }}>
            {day}
          </Text>
        ))}
      </View>
      <View role="radiogroup" aria-label={text.monthTitle(month)} style={{ gap: 4 }}>
        {monthGrid(month).map((week, row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 4 }}>
            {week.map((date, column) => {
              if (!date) {
                return <View key={column} style={{ flex: 1 }} />;
              }
              const types = days.get(date) ?? [];
              const chosen = date === selected;
              const future = date > today;
              const label = `${text.dayName(date)}, ${types.length > 0 ? typeNames(types) : t('history.calendar.nothing')}`;
              return (
                <Pressable
                  key={date}
                  role="radio"
                  aria-checked={chosen}
                  aria-disabled={future}
                  disabled={future}
                  aria-label={date === today ? `${label}, ${t('history.calendar.today')}` : label}
                  onPress={future ? undefined : () => onSelect(date)}
                  style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
                    flex: 1,
                    height: wide ? 52 : 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    borderRadius: radius[8],
                    borderWidth: 1.5,
                    borderColor: chosen ? colors.accent.fill : 'transparent',
                    backgroundColor: chosen ? colors.accent.subtle : hovered && !future ? colors.bg.surfaceRaised : 'transparent',
                    cursor: future ? 'auto' : 'pointer',
                    outlineStyle: 'solid',
                    outlineWidth: showFocusRing(focused) ? 2 : 0,
                    outlineColor: colors.accent.fill,
                  })}
                >
                  <Text
                    variant={types.length > 0 || chosen ? 'smallMedium' : 'small'}
                    tone={types.length > 0 || chosen ? 'primary' : 'muted'}
                    style={{ fontVariant: ['tabular-nums'], opacity: future ? 0.5 : 1 }}
                  >
                    {Number(date.slice(8))}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: MARK + 1 }}>
                    {types.map((type) => (
                      <TypeMark key={type} type={type} color={colorFor(colors, TYPE_DEFAULTS[type].color)} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[16], rowGap: space[8], marginTop: space[8] }}
        aria-label={t('history.calendar.legend')}
      >
        {TYPE_ORDER.map((type) => (
          <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TypeMark type={type} color={colors.text.primary} size={8} />
            <Text variant="caption" tone="muted">
              {t(`history.types.${type}`)}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
