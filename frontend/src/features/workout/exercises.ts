import type { TFunction } from 'i18next';
import { useMemo } from 'react';

import { useListExercises } from '@/shared/api/generated/endpoints/exercises/exercises';
import type { ExerciseOut } from '@/shared/api/generated/model';

import type { ExerciseInfo } from './rules';

export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body'] as const;
export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight', 'band', 'other'] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type Equipment = (typeof EQUIPMENT)[number];

/** Built-in exercises are named by key in the UI language; custom ones keep the person's name. */
export function exerciseName(exercise: Pick<ExerciseOut, 'key' | 'name' | 'is_custom'> | undefined, t: TFunction): string {
  if (!exercise || (!exercise.key && !exercise.name)) {
    return t('workout.unknownExercise');
  }
  if (exercise.is_custom || !exercise.key) {
    return exercise.name ?? '';
  }
  return t(`exercises.names.${exercise.key}`, { defaultValue: exercise.name ?? exercise.key });
}

/** What the draft keeps of a catalog entry, to name it without the catalog. */
export function infoOf(exercise: Pick<ExerciseOut, 'key' | 'name' | 'is_custom'> | undefined): ExerciseInfo {
  return { key: exercise?.key ?? null, name: exercise?.name ?? null, is_custom: exercise?.is_custom ?? false };
}

/** Bodyweight exercises may be logged without a weight; every other one needs it. */
export function isWeighted(exercise: Pick<ExerciseOut, 'equipment'> | undefined): boolean {
  return exercise?.equipment !== 'bodyweight';
}

/** Lower case without accents, so "wyciskanie" finds "Wyciskanie", "zolnierskie" finds "żołnierskie". */
export function searchable(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * The picker's list: exercises of the chosen muscle group whose name holds every typed word,
 * the ones used before first (most recent first), then by name.
 */
export function filterExercises(
  items: ExerciseOut[],
  query: string,
  muscle: MuscleGroup | 'all',
  nameOf: (exercise: ExerciseOut) => string,
  language: string,
): ExerciseOut[] {
  const words = searchable(query).split(/\s+/).filter(Boolean);
  return items
    .filter((exercise) => muscle === 'all' || exercise.muscle_group === muscle)
    .filter((exercise) => {
      const name = searchable(nameOf(exercise));
      return words.every((word) => name.includes(word));
    })
    .sort((a, b) => {
      const used = (b.last_used_date ?? '').localeCompare(a.last_used_date ?? '');
      return used !== 0 ? used : nameOf(a).localeCompare(nameOf(b), language);
    });
}

/**
 * The exercise list (built-in and custom), kept for the whole visit: it changes only when a
 * custom exercise is added, and a workout keeps naming its exercises from it.
 */
export function useExerciseCatalog() {
  const query = useListExercises({ query: { staleTime: 10 * 60_000, gcTime: 60 * 60_000 } });
  const items = query.data?.status === 200 ? query.data.data.items : undefined;
  const byId = useMemo(() => new Map((items ?? []).map((exercise) => [exercise.id, exercise])), [items]);
  return { query, items, byId };
}
