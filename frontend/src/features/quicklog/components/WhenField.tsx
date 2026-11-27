import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { parseIsoDate, toIsoDate } from '@/shared/format/dates';
import { formatTime } from '@/shared/format/time';
import { useNow } from '@/shared/hooks/useNow';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { DateField } from '@/shared/ui/DateField';
import { showFocusRing } from '@/shared/ui/focusRing';
import { CalendarDays, ChevronDown, CircleAlert } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';
import { TimeField } from '@/shared/ui/TimeField';

type Props = { date: string; time: string; error?: string; onChange: (date: string, time: string) => void };

/**
 * When it happened (design: the calendar row of a quick log): "Today, October 26 · 18:30".
 * Tapping it opens the date and the time, so a session can be logged afterwards (spec §3.2,
 * back-dating); a date after today cannot be chosen. Until the person changes them, the form
 * passes the current moment, so a form left open still saves when it was sent.
 */
export function WhenField({ date, time, error, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, radius, space } = useTheme();
  const compact = useBreakpoint() === 'compact';
  const [open, setOpen] = useState(false);
  const now = useNow(30_000);
  const today = toIsoDate(new Date(now));
  const yesterday = toIsoDate(new Date(now - 24 * 60 * 60_000));
  const day = new Intl.DateTimeFormat(i18n.language, { month: 'long', day: 'numeric' }).format(parseIsoDate(date));
  const relative = date === today ? t('quickLog.when.today') : date === yesterday ? t('quickLog.when.yesterday') : null;
  const summary = `${relative ? `${relative}, ${day}` : day} · ${formatTime(time, i18n.language)}`;

  return (
    <View style={{ gap: space[16] }}>
      <Pressable
        role="button"
        aria-expanded={open}
        aria-label={`${t('quickLog.when.label')}: ${summary}`}
        onPress={() => setOpen(!open)}
        style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[8],
          minHeight: 44,
          borderRadius: radius[8],
          opacity: hovered ? 0.8 : 1,
          cursor: 'pointer',
          outlineStyle: 'solid',
          outlineWidth: showFocusRing(focused) ? 2 : 0,
          outlineColor: colors.accent.fill,
        })}
      >
        <CalendarDays color={colors.text.muted} size={20} strokeWidth={1.75} />
        <Text variant="small" tone="muted" style={{ flex: 1 }}>
          {summary}
        </Text>
        <ChevronDown
          color={colors.text.primary}
          size={20}
          strokeWidth={1.75}
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {open ? (
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: space[16] }}>
          <View style={compact ? undefined : { flex: 1 }}>
            <DateField
              label={t('quickLog.when.date')}
              value={date}
              maximum={today}
              doneLabel={t('quickLog.when.done')}
              onChange={(next) => onChange(next, time)}
            />
          </View>
          <View style={compact ? undefined : { flex: 1 }}>
            <TimeField label={t('quickLog.when.time')} value={time} doneLabel={t('quickLog.when.done')} onChange={(next) => onChange(date, next)} />
          </View>
        </View>
      ) : null}
      {error ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[8] }}>
          <View style={{ flexShrink: 0 }}>
            <CircleAlert color={colors.state.error} size={16} strokeWidth={2} />
          </View>
          <Text variant="caption" style={{ flexShrink: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
