import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { openHomePage } from '@/features/navigation/openHomePage';
import { getListExercisesQueryKey, lastSets, listExercises } from '@/shared/api/generated/endpoints/exercises/exercises';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { getSession } from '@/shared/api/generated/endpoints/sessions/sessions';
import { useHome } from '@/shared/api/generated/endpoints/stats/stats';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { UpNext } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';
import { newId } from '@/shared/ids';

import { infoOf, isWeighted } from './exercises';
import { normalizeGroups, previousFrom, type WorkoutDraft } from './rules';
import { buildExercise, useWorkout, workout, type WorkoutSummary } from './store';

type Start = { userId: string; trackerId: string; trackerName: string; upNext: UpNext | null };

/**
 * A new workout for the main tracker. It repeats the tracker's last workout (spec §3.10):
 * the same name and exercises, supersets kept, each exercise with one row per set of the
 * last session that had it and those values as ghosts. Without a connection it starts empty.
 */
export async function prepareWorkout(client: QueryClient, start: Start, now = new Date()): Promise<WorkoutDraft> {
  const draft: WorkoutDraft = {
    version: 1,
    id: newId(),
    userId: start.userId,
    trackerId: start.trackerId,
    name: start.upNext?.name || start.trackerName,
    startedAt: now.toISOString(),
    localDate: toIsoDate(now),
    exercises: [],
    rest: null,
  };
  if (!start.upNext) {
    return draft;
  }
  try {
    const [session, catalog] = await Promise.all([
      getSession(start.upNext.session_id),
      client.fetchQuery({ queryKey: getListExercisesQueryKey(), queryFn: () => listExercises(), staleTime: 10 * 60_000 }),
    ]);
    if (session.status !== 200 || catalog.status !== 200) {
      throw new Error('Unexpected response');
    }
    const byId = new Map(catalog.data.items.map((exercise) => [exercise.id, exercise]));
    const entries = [...(session.data.strength?.exercises ?? [])].sort((a, b) => a.position - b.position);
    const previous = await Promise.all(
      entries.map(async (entry) => {
        const own = previousFrom(entry.sets);
        try {
          const response = await lastSets(entry.exercise_id);
          const latest = response.status === 200 ? previousFrom(response.data.sets) : [];
          return latest.length > 0 ? latest : own;
        } catch {
          return own;
        }
      }),
    );
    draft.exercises = normalizeGroups(
      entries.map((entry, index) =>
        buildExercise({
          exerciseId: entry.exercise_id,
          info: infoOf(byId.get(entry.exercise_id)),
          weighted: isWeighted(byId.get(entry.exercise_id)),
          previous: previous[index],
          group: entry.superset_group ?? null,
        }),
      ),
    );
  } catch {
    draft.prefillFailed = true;
  }
  return draft;
}

function useAccountId(): string | undefined {
  const me = useReadMe();
  return me.data?.status === 200 ? me.data.data.id : undefined;
}

/**
 * The workout on this device, if it belongs to the signed-in account. A workout or summary
 * left by another account on a shared device is dropped once the account is known.
 */
export function useActiveDraft(): WorkoutDraft | null {
  const draft = useWorkout((state) => state.draft);
  const accountId = useAccountId();
  const foreign = Boolean(draft && accountId && draft.userId !== accountId);
  useEffect(() => {
    if (foreign) {
      workout.discard();
    }
  }, [foreign]);
  return draft && !foreign ? draft : null;
}

export function useActiveSummary(): WorkoutSummary | null {
  const summary = useWorkout((state) => state.summary);
  const accountId = useAccountId();
  const foreign = Boolean(summary && accountId && summary.userId !== accountId);
  useEffect(() => {
    if (foreign) {
      workout.closeSummary();
    }
  }, [foreign]);
  return summary && !foreign ? summary : null;
}

export type WorkoutEntry = {
  /** Something to open: a workout under way, or a main tracker to start one for. */
  available: boolean;
  /** A workout is under way on this device: the button says "Resume workout". */
  active: boolean;
  starting: boolean;
  open: () => Promise<void>;
};

/**
 * Start workout / Resume workout, wherever the button is (Home, the sidebar, Trackers):
 * starts a workout for the main tracker when none is under way, then opens it over Home.
 * `showHomeTab` switches to the Home tab when the button is on another one.
 */
export function useWorkoutEntry(showHomeTab: () => void): WorkoutEntry {
  const client = useQueryClient();
  const pathname = usePathname();
  const draft = useActiveDraft();
  const me = useReadMe();
  const home = useHome();
  const trackers = useListTrackers({ include_archived: true });
  const [starting, setStarting] = useState(false);
  const account = me.data?.status === 200 ? me.data.data : undefined;
  const stats = home.data?.status === 200 ? home.data.data : undefined;
  const mainId = stats?.main_tracker_id ?? account?.main_tracker_id ?? null;
  const items = trackers.data?.status === 200 ? trackers.data.data.items : [];
  const main = items.find((tracker) => tracker.id === mainId && tracker.type === 'strength' && !tracker.archived);

  const open = async () => {
    if (!useWorkout.getState().draft) {
      if (!main || !account) {
        return;
      }
      setStarting(true);
      try {
        const upNext = stats?.main_tracker_id === main.id ? stats.up_next : null;
        const prepared = await prepareWorkout(client, {
          userId: account.id,
          trackerId: main.id,
          trackerName: main.name,
          upNext,
        });
        if (!useWorkout.getState().draft) {
          workout.begin(prepared);
        }
      } finally {
        setStarting(false);
      }
    }
    openHomePage('/workout', pathname, showHomeTab);
  };

  return { available: Boolean(draft) || Boolean(main && account), active: Boolean(draft), starting, open };
}
