import { useTranslation } from 'react-i18next';

import { useGoalText } from '@/features/goals/format';
import { usePreferences } from '@/features/settings/preferences';
import type { SessionListItem } from '@/shared/api/generated/model';
import { parseIsoDate } from '@/shared/format/dates';

import { relativeDay } from './rules';

const KG_TO_LB = 2.2046226218;

/** Home's numbers in words, in the UI language and the person's units. */
export function useHomeText() {
  const { t, i18n } = useTranslation();
  const weightUnit = usePreferences((state) => state.values.weight_unit);
  const goalText = useGoalText();
  const number = (value: number, digits = 0) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: digits }).format(value);

  /** "48 min", "1 h 12 min", "2 h": whole minutes, rounded. */
  function duration(seconds: number): string {
    const total = Math.round(seconds / 60);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours === 0) {
      return t('home.duration.minutes', { minutes: number(minutes) });
    }
    return minutes === 0
      ? t('home.duration.hours', { hours: number(hours) })
      : t('home.duration.hoursMinutes', { hours: number(hours), minutes: number(minutes) });
  }

  /** "Today", "Yesterday", "Saturday", or "Oct 12" for older days. */
  function day(localDate: string, today: string): string {
    const kind = relativeDay(localDate, today);
    if (kind === 'today' || kind === 'yesterday') {
      return t(`home.day.${kind}`);
    }
    const options: Intl.DateTimeFormatOptions = kind === 'week' ? { weekday: 'long' } : { day: 'numeric', month: 'short' };
    const text = new Intl.DateTimeFormat(i18n.language, options).format(parseIsoDate(localDate));
    return text.charAt(0).toLocaleUpperCase(i18n.language) + text.slice(1);
  }

  /** A weight in the person's unit, to one decimal: "4,820 kg", "10,626.5 lb". */
  function weight(kg: number): string {
    const value = weightUnit === 'lb' ? kg * KG_TO_LB : kg;
    const rounded = Math.round(value * 10) / 10;
    return t(`home.weight.${weightUnit}`, { count: rounded, formatted: number(rounded, 1) });
  }

  /** The number of a weight without its unit, for the weekly stats ("9,240"). */
  function weightValue(kg: number): string {
    const value = weightUnit === 'lb' ? kg * KG_TO_LB : kg;
    return number(Math.round(value));
  }

  /** The main figure of a session in a list: "4,820 kg", "5.2 km", "24 pages", "8 glasses". */
  function headline(item: SessionListItem): string {
    const { metric, value, unit_label: unit } = item.headline;
    if (metric === 'volume_kg') {
      return weight(value);
    }
    if (metric === 'distance_m') {
      return goalText.amount('distance', value, { name: '', counter_unit: null });
    }
    if (metric === 'pages') {
      return goalText.amount('pages', value, { name: '', counter_unit: null });
    }
    if (metric === 'count') {
      return `${number(value, 2)} ${unit ?? ''}`.trim();
    }
    return duration(value);
  }

  /** "Yesterday · 48 min"; the duration is left out when a session has none. */
  function sessionLine(item: SessionListItem, today: string): string {
    const when = day(item.local_date, today);
    return item.duration_s ? `${when} · ${duration(item.duration_s)}` : when;
  }

  return { day, duration, headline, number, sessionLine, weight, weightUnit, weightValue };
}
