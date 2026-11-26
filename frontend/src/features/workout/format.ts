import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useHomeText } from '@/features/home/format';

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
    clock,
    restClock,
  };
}
