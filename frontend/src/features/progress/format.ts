import { useTranslation } from 'react-i18next';

import { useHomeText } from '@/features/home/format';
import type { RecordOut } from '@/shared/api/generated/model';
import { formatDate, parseIsoDate } from '@/shared/format/dates';

import { compactNumber, type Period } from './rules';

const KG_TO_LB = 2.2046226218;

/** Progress's numbers and dates in words, in the UI language and the person's units. */
export function useProgressText() {
  const { t, i18n } = useTranslation();
  const home = useHomeText();
  const language = i18n.language;
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(language, options).format(parseIsoDate(date));
  const inUnit = (kg: number) => (home.weightUnit === 'lb' ? kg * KG_TO_LB : kg);

  /** "Oct 5". */
  function shortDate(date: string): string {
    return format(date, { month: 'short', day: 'numeric' });
  }

  /** "Oct" for a monthly bar, "Oct 5" for a weekly one. */
  function bucketDate(date: string, bucket: 'week' | 'month'): string {
    return bucket === 'month' ? format(date, { month: 'short' }) : shortDate(date);
  }

  /** "Aug — Oct": the months the consistency grid covers. */
  function monthSpan(start: string, end: string): string {
    const first = format(start, { month: 'short' });
    const last = format(end, { month: 'short' });
    return first === last ? first : `${first} — ${last}`;
  }

  /** A weight in the person's unit for an axis or a headline: "62.5". */
  function weightNumber(kg: number): string {
    return home.number(Math.round(inUnit(kg) * 10) / 10, 1);
  }

  /** "6.0k": a bar's volume in the person's unit. */
  function volumeShort(kg: number): string {
    return compactNumber(Math.round(inUnit(kg)), language);
  }

  /** "+7.5 kg in 4 weeks", "−2.5 kg since you started"; nothing without a change. */
  function change(kg: number | null | undefined, period: Period): string | null {
    if (kg === null || kg === undefined) {
      return null;
    }
    const value = Math.round(inUnit(kg) * 10) / 10;
    const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
    const amount = `${sign}${home.number(Math.abs(value), 1)} ${t(`profile.units.${home.weightUnit}`)}`;
    return t(`progress.line.change.${period}`, { amount });
  }

  /** The record's own words, as on Summary: "Max weight · 62.5 kg", "Max reps · 10 at 60 kg". */
  function recordKind(record: Pick<RecordOut, 'record_type'>): string {
    return t(`progress.records.kind.${record.record_type}`);
  }

  /** "62.5 kg", "10 reps", "83.3 kg". */
  function recordValue(record: Pick<RecordOut, 'record_type' | 'value'>): string {
    return record.record_type === 'max_reps' ? t('history.detail.reps', { count: record.value }) : home.weight(record.value);
  }

  /** "Oct 25, 2026 · 8 reps", "· 60 kg", "· Epley estimate". */
  function recordDetail(record: Pick<RecordOut, 'record_type' | 'local_date' | 'weight_kg' | 'reps'>): string {
    const date = formatDate(record.local_date, language);
    if (record.record_type === 'max_weight') {
      return `${date} · ${t('history.detail.reps', { count: record.reps })}`;
    }
    if (record.record_type === 'max_reps') {
      return record.weight_kg === null ? `${date} · ${t('progress.records.bodyweight')}` : `${date} · ${home.weight(record.weight_kg)}`;
    }
    return `${date} · ${t('progress.records.epley')}`;
  }

  return { ...home, shortDate, bucketDate, monthSpan, weightNumber, volumeShort, change, recordKind, recordValue, recordDetail };
}
