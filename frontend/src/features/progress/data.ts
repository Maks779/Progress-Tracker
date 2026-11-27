import { type QueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { CACHE_GC_TIME } from '@/shared/api/cache';
import { isOffline } from '@/shared/api/connection';
import {
  exerciseRecords,
  getExerciseRecordsQueryKey,
  getListRecordsQueryKey,
  listRecords,
  useExerciseProgress,
  useExerciseRecords,
} from '@/shared/api/generated/endpoints/exercises/exercises';
import { useProgress } from '@/shared/api/generated/endpoints/stats/stats';
import type { ExerciseRecords, RecordOut, SessionWrite } from '@/shared/api/generated/model';

import { newRecords, type Period } from './rules';

/** Records asked for at a time on the Records page; more come with Show more. */
export const RECORDS_PAGE = 50;

/** How long an exercise's bests count as fresh: they change only when a session is saved, which refreshes them. */
const BESTS_FRESH_MS = 10 * 60_000;

/** The overview of a period: volume and pages by week or month, active days and totals. Kept on the device. */
export function useOverview(period: Period, trackerId: string | null) {
  return useProgress({ period, tracker_id: trackerId ?? undefined }, { query: { gcTime: CACHE_GC_TIME } });
}

/** One exercise's line: the heaviest working set of each session in the period. Kept on the device. */
export function useExerciseLine(exerciseId: string | undefined, period: Period) {
  return useExerciseProgress(exerciseId ?? '', { period }, { query: { enabled: Boolean(exerciseId), gcTime: CACHE_GC_TIME } });
}

/** Every current personal best, newest first, a page at a time, with how many are new this week. */
export function useRecordsList() {
  const params = { limit: RECORDS_PAGE };
  const query = useInfiniteQuery({
    queryKey: [...getListRecordsQueryKey(params), 'pages'],
    queryFn: async ({ pageParam }) => {
      const answer = await listRecords({ ...params, cursor: pageParam ?? undefined });
      if (answer.status !== 200) {
        throw new Error('Unexpected response');
      }
      return answer.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    gcTime: CACHE_GC_TIME,
  });
  const items: RecordOut[] | undefined = query.data?.pages.flatMap((page) => page.items);
  return { query, items, newThisWeek: query.data?.pages[0]?.new_this_week ?? 0 };
}

/** An exercise's current bests, what a set must beat to be a record (spec §3.4). Kept on the device for offline workouts. */
export function useExerciseBests(exerciseId: string, enabled = true): ExerciseRecords | undefined {
  const query = useExerciseRecords(exerciseId, { query: { enabled, staleTime: BESTS_FRESH_MS, gcTime: CACHE_GC_TIME } });
  return query.data?.status === 200 ? query.data.data : undefined;
}

/** The bests of a workout's exercises, loaded ahead while online, so records show offline too. */
export function prefetchBests(client: QueryClient, exerciseIds: string[]): void {
  if (isOffline()) {
    return;
  }
  for (const id of new Set(exerciseIds)) {
    void client.prefetchQuery({
      queryKey: getExerciseRecordsQueryKey(id),
      queryFn: () => exerciseRecords(id),
      staleTime: BESTS_FRESH_MS,
      gcTime: CACHE_GC_TIME,
      retry: false,
    });
  }
}

/** The bests saved on the device for an exercise, for a Summary that waits to be sent. */
export function savedBests(client: QueryClient, exerciseId: string): ExerciseRecords | undefined {
  const answer = client.getQueryData<{ status: number; data: ExerciseRecords }>(getExerciseRecordsQueryKey(exerciseId));
  return answer?.status === 200 ? answer.data : undefined;
}

export type CountedRecord = Pick<RecordOut, 'exercise_id' | 'record_type' | 'value' | 'weight_kg' | 'reps'>;

/**
 * The records of a workout still waiting on the device, counted against the bests saved there
 * with the server's rules (spec §3.4): all working sets of an exercise together, as the server
 * counts them. The server's answer replaces them once the workout is sent.
 */
export function deviceRecords(client: QueryClient, body: SessionWrite): CountedRecord[] {
  const sets = new Map<string, { weightKg: number | null; reps: number }[]>();
  for (const entry of body.strength?.exercises ?? []) {
    const working = entry.sets
      .filter((set) => (set.kind ?? 'working') === 'working')
      .map((set) => ({ weightKg: set.weight_kg === null || set.weight_kg === undefined ? null : Number(set.weight_kg), reps: set.reps }));
    sets.set(entry.exercise_id, [...(sets.get(entry.exercise_id) ?? []), ...working]);
  }
  return [...sets].flatMap(([exerciseId, logged]) =>
    newRecords(savedBests(client, exerciseId), logged).map((record) => ({
      exercise_id: exerciseId,
      record_type: record.recordType,
      value: record.value,
      weight_kg: record.weightKg,
      reps: record.reps,
    })),
  );
}
