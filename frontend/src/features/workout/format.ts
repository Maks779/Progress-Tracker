import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useHomeText } from '@/features/home/format';

import type { RecordOut } from '@/shared/api/generated/model';

import type { PreviousSet } from './rules';
import { clock, weightIn } from './rules';

/** The workout's numbers in words, in the UI language and the person's weight unit. */
export function useWorkoutText() {
  const { t, i18n } = useTranslation();
  const home = useHomeText();
  const unit = home.weightUnit;

  /** A weight for a field: the person's unit, up to 2 decimals, no thousands separator ("62.5", "62,5"). */
  const fieldWeight = useCallback(
    (kg: number) =>
      new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2, useGrouping: false }).format(weightIn(kg, unit)),
    [i18n.language, unit],
  );

  /** The Previous column: "60 × 8", or "12 reps" for a set without weight. */
  function previous(set: PreviousSet | undefined): string {
    if (!set) {
      return '—';
    }
    return set.weightKg === null
      ? t('workout.set.repsOnly', { count: set.reps })
      : `${fieldWeight(set.weightKg)} × ${set.reps}`;
  }

  /** A record as a badge, live in the workout and on Summary: "Max weight · 62.5 kg", "Max reps · 10 at 60 kg". */
  function recordBadge(record: Pick<RecordOut, 'record_type' | 'value' | 'weight_kg' | 'reps'>): string {
    if (record.record_type === 'max_weight') {
      return t('workout.summary.maxWeight', { weight: home.weight(record.value) });
    }
    if (record.record_type === 'max_reps') {
      return record.weight_kg === null
        ? t('workout.summary.maxRepsBodyweight', { count: record.reps })
        : t('workout.summary.maxReps', { count: record.reps, weight: home.weight(record.weight_kg) });
    }
    return t('workout.summary.estimated', { weight: home.weight(record.value) });
  }

  /** "01:24": the rest timer, always with two-digit minutes. */
  function restClock(seconds: number): string {
    const text = clock(seconds);
    return text.length === 4 ? `0${text}` : text;
  }

  return {
    ...home,
    unit,
    unitLabel: t(`profile.units.${unit}`),
    fieldWeight,
    previous,
    recordBadge,
    clock,
    restClock,
  };
}
