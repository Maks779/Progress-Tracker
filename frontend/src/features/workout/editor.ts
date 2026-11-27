import { newId } from '@/shared/ids';

import {
  type DraftExercise,
  type ExerciseInfo,
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

export type DraftChange = (update: (draft: WorkoutDraft) => WorkoutDraft) => void;

/**
 * What the exercise cards, their menus and the exercise picker change in a draft: the active
 * workout's, or a saved session's while it is edited in History. `change` applies an update to
 * wherever that draft lives.
 */
export function draftActions(change: DraftChange) {
  const changeExercise = (index: number, update: (exercise: DraftExercise) => DraftExercise) =>
    change((draft) => ({
      ...draft,
      exercises: draft.exercises.map((exercise, position) => (position === index ? update(exercise) : exercise)),
    }));
  return {
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
  };
}

export type DraftActions = ReturnType<typeof draftActions>;
