import { Platform } from 'react-native';
import { z } from 'zod';
import { create } from 'zustand';

import type { SessionSaved } from '@/shared/api/generated/model';
import { newId } from '@/shared/ids';
import { storage } from '@/shared/storage/storage';

import {
  type DraftExercise,
  type ExerciseInfo,
  extendRest,
  groupWithNext,
  leaveGroup,
  MAX_EXERCISES,
  MAX_SETS,
  newExercise,
  newSet,
  normalizeGroups,
  type PreviousSet,
  replaceSet,
  type SetKind,
  toggleSet,
  type WorkoutDraft,
} from './rules';

const STORAGE_KEY = 'ember.workout';

/** What Summary shows after Finish; kept until Done, so it survives a restart too. */
export type WorkoutSummary = { userId: string; trackerName: string; saved: SessionSaved };

type State = { hydrated: boolean; draft: WorkoutDraft | null; summary: WorkoutSummary | null };

/**
 * The active workout lives on the device from Start to Finish (offline level B): in memory for
 * the screens, and in storage after every change, so closing the app or the tab loses nothing.
 */
export const useWorkout = create<State>()(() => ({ hydrated: false, draft: null, summary: null }));

const setKind = z.enum(['working', 'warmup']);
const weight = z.number().nullable();
const draftSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  userId: z.string(),
  trackerId: z.string(),
  name: z.string(),
  startedAt: z.string(),
  localDate: z.string(),
  exercises: z.array(
    z.object({
      id: z.string(),
      exerciseId: z.string(),
      info: z.object({ key: z.string().nullable(), name: z.string().nullable(), is_custom: z.boolean() }),
      group: z.number().nullable(),
      weighted: z.boolean(),
      previous: z.array(z.object({ weightKg: weight, reps: z.number(), kind: setKind })),
      sets: z.array(
        z.object({
          id: z.string(),
          kind: setKind,
          weightKg: weight,
          reps: z.number().nullable(),
          ghost: z.object({ weightKg: weight, reps: z.number() }).nullable(),
          done: z.boolean(),
        }),
      ),
    }),
  ),
  rest: z.object({ endsAt: z.number(), seconds: z.number() }).nullable(),
  prefillFailed: z.boolean().optional(),
});
const summarySchema = z.object({
  userId: z.string(),
  trackerName: z.string(),
  saved: z.looseObject({
    session: z.looseObject({ id: z.string() }),
    new_records: z.array(z.looseObject({})),
  }),
});

let loading = false;

async function load(): Promise<void> {
  const saved = await storage.read<{ draft?: unknown; summary?: unknown }>(STORAGE_KEY);
  const draft = draftSchema.safeParse(saved?.draft);
  const summary = summarySchema.safeParse(saved?.summary);
  loading = true;
  useWorkout.setState({
    hydrated: true,
    draft: draft.success ? draft.data : null,
    summary: summary.success ? (summary.data as unknown as WorkoutSummary) : null,
  });
  loading = false;
}

useWorkout.subscribe((state, previous) => {
  if (loading || !state.hydrated || (state.draft === previous.draft && state.summary === previous.summary)) {
    return;
  }
  void storage.write(STORAGE_KEY, { draft: state.draft, summary: state.summary });
});

let listening = false;

/**
 * Loads the saved workout at start-up; anything unreadable is dropped. On the web another tab
 * may change the workout, so this tab reloads it when the stored copy changes.
 */
export async function hydrateWorkout(): Promise<void> {
  if (Platform.OS === 'web' && !listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        void load();
      }
    });
  }
  await load();
}

function change(update: (draft: WorkoutDraft) => WorkoutDraft): void {
  const { draft } = useWorkout.getState();
  if (draft) {
    useWorkout.setState({ draft: update(draft) });
  }
}

function changeExercise(index: number, update: (exercise: DraftExercise) => DraftExercise): void {
  change((draft) => ({
    ...draft,
    exercises: draft.exercises.map((exercise, position) => (position === index ? update(exercise) : exercise)),
  }));
}

export type NewExercise = {
  exerciseId: string;
  info: ExerciseInfo;
  weighted: boolean;
  previous: PreviousSet[];
  group?: number | null;
};

/** A fresh exercise with new IDs for the entry and each set row. */
export function buildExercise({ exerciseId, info, weighted, previous, group = null }: NewExercise): DraftExercise {
  return newExercise(
    { entry: newId(), sets: Array.from({ length: Math.max(1, previous.length) }, newId) },
    exerciseId,
    info,
    weighted,
    previous,
    group,
  );
}

/** Every change to the active workout; each one is saved to the device at once. */
export const workout = {
  begin(draft: WorkoutDraft): void {
    useWorkout.setState({ draft, summary: null });
  },
  rename(name: string): void {
    change((draft) => ({ ...draft, name }));
  },
  addExercises(items: NewExercise[]): void {
    change((draft) => ({
      ...draft,
      exercises: [...draft.exercises, ...items.map(buildExercise)].slice(0, MAX_EXERCISES),
      prefillFailed: false,
    }));
  },
  removeExercise(index: number): void {
    change((draft) => ({ ...draft, exercises: normalizeGroups(draft.exercises.filter((_, position) => position !== index)) }));
  },
  groupWithNext(index: number): void {
    change((draft) => ({ ...draft, exercises: groupWithNext(draft.exercises, index) }));
  },
  leaveGroup(index: number): void {
    change((draft) => ({ ...draft, exercises: leaveGroup(draft.exercises, index) }));
  },
  addSet(index: number): void {
    changeExercise(index, (exercise) =>
      exercise.sets.length >= MAX_SETS ? exercise : { ...exercise, sets: [...exercise.sets, newSet(newId(), exercise)] },
    );
  },
  removeSet(index: number, setIndex: number): void {
    changeExercise(index, (exercise) => ({ ...exercise, sets: exercise.sets.filter((_, position) => position !== setIndex) }));
  },
  setKind(index: number, setIndex: number, kind: SetKind): void {
    change((draft) => replaceSet(draft, index, setIndex, { ...draft.exercises[index].sets[setIndex], kind }));
  },
  setWeight(index: number, setIndex: number, weightKg: number | null): void {
    change((draft) => replaceSet(draft, index, setIndex, { ...draft.exercises[index].sets[setIndex], weightKg }));
  },
  setReps(index: number, setIndex: number, reps: number | null): void {
    change((draft) => replaceSet(draft, index, setIndex, { ...draft.exercises[index].sets[setIndex], reps }));
  },
  toggleSet(index: number, setIndex: number, now = Date.now()): void {
    change((draft) => toggleSet(draft, index, setIndex, now));
  },
  extendRest(now = Date.now()): void {
    change((draft) => (draft.rest ? { ...draft, rest: extendRest(draft.rest, now) } : draft));
  },
  skipRest(): void {
    change((draft) => ({ ...draft, rest: null }));
  },
  discard(): void {
    useWorkout.setState({ draft: null });
  },
  finished(summary: WorkoutSummary): void {
    useWorkout.setState({ draft: null, summary });
  },
  updateSummary(saved: SessionSaved): void {
    const { summary } = useWorkout.getState();
    if (summary) {
      useWorkout.setState({ summary: { ...summary, saved: { ...saved, new_records: summary.saved.new_records } } });
    }
  },
  closeSummary(): void {
    useWorkout.setState({ summary: null });
  },
  /** Log out and account deletion: nothing of this account stays on the device. */
  clear(): void {
    useWorkout.setState({ draft: null, summary: null });
  },
};
