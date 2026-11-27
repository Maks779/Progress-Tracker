import { useTranslation } from 'react-i18next';

import { useHomeText } from '@/features/home/format';
import { formatDuration } from '@/features/quicklog/rules';
import { usePreferences } from '@/features/settings/preferences';
import { clock } from '@/features/workout/rules';
import type { StrengthSetOut } from '@/shared/api/generated/model';
import { parseIsoDate } from '@/shared/format/dates';
import { dateToTime, formatTime } from '@/shared/format/time';

import { addDays, type Week, weekKind } from './rules';

const METRES = { km: 1000, mi: 1609.344 } as const;

function capitalize(text: string, language: string): string {
  return text.charAt(0).toLocaleUpperCase(language) + text.slice(1);
}

/** History's dates and numbers in words, in the UI language and the person's units. */
export function useHistoryText() {
  const { t, i18n } = useTranslation();
  const home = useHomeText();
  const distanceUnit = usePreferences((state) => state.values.distance_unit);
  const language = i18n.language;
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(language, options).format(parseIsoDate(date));

  /** "October 2026". */
  function monthTitle(month: string): string {
    return capitalize(format(`${month}-01`, { month: 'long', year: 'numeric' }), language);
  }

  /** "M", "T", … from Monday, for the calendar's heading. */
  function weekdays(): string[] {
    return Array.from({ length: 7 }, (_, index) => format(addDays('2026-01-05', index), { weekday: 'narrow' }).toLocaleUpperCase(language));
  }

  /** "Monday, October 26", for a calendar day read aloud. */
  function dayName(date: string): string {
    return capitalize(format(date, { weekday: 'long', month: 'long', day: 'numeric' }), language);
  }

  /** "This week", "Last week", "October 19 – 25" (ISO weeks, Monday to Sunday). */
  function weekTitle(week: Week, today: string): string {
    const kind = weekKind(week, today);
    if (kind !== 'other') {
      return t(`history.week.${kind}`);
    }
    const values = {
      start: capitalize(format(week.from, { month: 'long', day: 'numeric' }), language),
      startDay: format(week.from, { day: 'numeric' }),
      end: format(week.to, { month: 'long', day: 'numeric' }),
      endDay: format(week.to, { day: 'numeric' }),
    };
    return week.from.slice(0, 7) === week.to.slice(0, 7) ? t('history.week.rangeSameMonth', values) : t('history.week.range', values);
  }

  /** "Sunday, Oct 25 · 6:30 PM": when a session started, in the device's time zone. */
  function startedCaption(startedAt: string): string {
    const started = new Date(startedAt);
    const day = new Intl.DateTimeFormat(language, { weekday: 'long', month: 'short', day: 'numeric' }).format(started);
    return `${capitalize(day, language)} · ${formatTime(dateToTime(started), language)}`;
  }

  /** "12.4": hours with one decimal. */
  function hours(seconds: number): string {
    return home.number(Math.round((seconds / 3600) * 10) / 10, 1);
  }

  /** A distance in the person's unit, up to two decimals: "5.2". */
  function distance(metres: number): string {
    return home.number(metres / METRES[distanceUnit], 2);
  }

  /** "6:09": the pace per km or per mi. */
  function pace(secondsPerKm: number): string {
    return formatDuration(Math.round(secondsPerKm * (METRES[distanceUnit] / 1000)));
  }

  /** "62.5 kg × 8 reps", or "12 reps" for a set without weight. */
  function setLine(set: Pick<StrengthSetOut, 'weight_kg' | 'reps'>): string {
    const reps = t('history.detail.reps', { count: set.reps });
    return set.weight_kg === null ? reps : `${home.weight(set.weight_kg)} × ${reps}`;
  }

  /** "3 × 10 at 50 kg", or "3 × 12 reps" without weight. */
  function sameLine(same: { count: number; reps: number; weightKg: number | null }): string {
    return same.weightKg === null
      ? t('history.detail.sameBodyweight', { count: same.count, reps: same.reps })
      : t('history.detail.same', { count: same.count, reps: same.reps, weight: home.weight(same.weightKg) });
  }

  return {
    ...home,
    distanceUnit,
    distanceLabel: t(`goals.units.${distanceUnit}`),
    monthTitle,
    weekdays,
    dayName,
    weekTitle,
    startedCaption,
    hours,
    distance,
    pace,
    clock,
    setLine,
    sameLine,
  };
}
