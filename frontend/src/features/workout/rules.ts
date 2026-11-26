import type { SessionOut, SessionWrite, StrengthSetOut } from '@/shared/api/generated/model';

/** The rules of an active workout (spec §3.3), as pure functions over the draft. */

export type SetKind = 'working' | 'warmup';

/** A set from the last session with the exercise: the "Previous" column and the ghost values. */
export type PreviousSet = { weightKg: number | null; reps: number; kind: SetKind };

export type Ghost = { weightKg: number | null; reps: number };

/** `weightKg` and `reps` are what was typed; empty fields fall back to the ghost values. */
export type DraftSet = {
  id: string;
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
  ghost: Ghost | null;
  done: boolean;
};

/** Enough of the catalog entry to name the exercise offline and in any UI language. */
export type ExerciseInfo = { key: string | null; name: string | null; is_custom: boolean };

export type DraftExercise = {
  id: string;
  exerciseId: string;
  info: ExerciseInfo;
  /** Exercises with the same number next to each other form a superset. */
  group: number | null;
  /** False for bodyweight exercises, whose sets may have no weight. */
  weighted: boolean;
  previous: PreviousSet[];
  sets: DraftSet[];
};

export type Rest = { endsAt: number; seconds: number };

export type WorkoutDraft = {
  version: 1;
  id: string;
  userId: string;
  trackerId: string;
  name: string;
  startedAt: string;
  localDate: string;
  exercises: DraftExercise[];
  rest: Rest | null;
  /** The last session could not be loaded when the workout started, so it starts empty. */
  prefillFailed?: boolean;
};

export const REST_SECONDS = 90;
export const REST_STEP_SECONDS = 30;
export const MAX_EXERCISES = 30;
export const MAX_SETS = 50;
export const MAX_WEIGHT_KG = 1000;
export const MAX_REPS = 100;
export const MAX_DURATION_S = 86_400;
export const KG_PER_LB = 0.45359237;

export type WeightUnit = 'kg' | 'lb';

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Sets from the API, in the draft's shape. */
export function previousFrom(sets: StrengthSetOut[]): PreviousSet[] {
  return [...sets]
    .sort((a, b) => a.position - b.position)
    .map((set) => ({ weightKg: set.weight_kg, reps: set.reps, kind: set.kind }));
}

/** The values a set would be saved with: typed values first, else the ghost values. */
export function effective(set: DraftSet): { weightKg: number | null; reps: number | null } {
  const weightKg = set.weightKg ?? set.ghost?.weightKg ?? null;
  return { weightKg: weightKg === 0 ? null : weightKg, reps: set.reps ?? set.ghost?.reps ?? null };
}

export type SetProblem = 'weightRequired' | 'weightRange' | 'repsRequired' | 'repsRange';

/**
 * Why a set cannot be checked yet, if at all. Reps are always needed; a weight only for a
 * weighted exercise (a bodyweight set may have none, or extra weight).
 */
export function setProblems(set: DraftSet, weighted: boolean): SetProblem[] {
  const { weightKg, reps } = effective(set);
  const problems: SetProblem[] = [];
  if (weightKg === null) {
    if (weighted) {
      problems.push('weightRequired');
    }
  } else if (weightKg < 0 || weightKg > MAX_WEIGHT_KG) {
    problems.push('weightRange');
  }
  if (reps === null) {
    problems.push('repsRequired');
  } else if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) {
    problems.push('repsRange');
  }
  return problems;
}

/** The number a working set shows (1, 2, …), counting working sets only; null for a warm-up. */
export function setNumber(sets: DraftSet[], index: number): number | null {
  if (sets[index]?.kind !== 'working') {
    return null;
  }
  return sets.slice(0, index + 1).filter((set) => set.kind === 'working').length;
}

/** A new set row: its ghost is the same set of the last session, else the set above it. */
export function newSet(id: string, exercise: DraftExercise): DraftSet {
  const index = exercise.sets.length;
  const previous = exercise.previous[index];
  if (previous) {
    return { id, kind: previous.kind, weightKg: null, reps: null, ghost: { weightKg: previous.weightKg, reps: previous.reps }, done: false };
  }
  const above = exercise.sets[index - 1];
  const values = above ? effective(above) : null;
  const ghost = values && values.reps !== null ? { weightKg: values.weightKg, reps: values.reps } : null;
  return { id, kind: 'working', weightKg: null, reps: null, ghost, done: false };
}

/** An exercise as it enters the workout: one row per set of last time, or one empty row. */
export function newExercise(
  ids: { entry: string; sets: string[] },
  exerciseId: string,
  info: ExerciseInfo,
  weighted: boolean,
  previous: PreviousSet[],
  group: number | null = null,
): DraftExercise {
  const exercise: DraftExercise = { id: ids.entry, exerciseId, info, group, weighted, previous, sets: [] };
  const count = Math.max(1, previous.length);
  for (let index = 0; index < count; index += 1) {
    exercise.sets.push(newSet(ids.sets[index] ?? `${ids.entry}-${index}`, exercise));
  }
  return exercise;
}

/**
 * Supersets are runs of neighbours with the same group number. Renumbers them 1, 2, … in
 * order and ungroups a run of one, so removing or regrouping an exercise never leaves a
 * superset of one or two groups under one number.
 */
export function normalizeGroups(exercises: DraftExercise[]): DraftExercise[] {
  const result: DraftExercise[] = [];
  let next = 1;
  let index = 0;
  while (index < exercises.length) {
    const group = exercises[index].group;
    let end = index + 1;
    while (group !== null && end < exercises.length && exercises[end].group === group) {
      end += 1;
    }
    const run = exercises.slice(index, end);
    const number = group !== null && run.length > 1 ? next++ : null;
    for (const exercise of run) {
      result.push(exercise.group === number ? exercise : { ...exercise, group: number });
    }
    index = end;
  }
  return result;
}

/** "Superset with next exercise": the next exercise (and its superset) joins this one's. */
export function groupWithNext(exercises: DraftExercise[], index: number): DraftExercise[] {
  const current = exercises[index];
  const following = exercises[index + 1];
  if (!current || !following) {
    return exercises;
  }
  const group = current.group ?? following.group ?? Math.max(0, ...exercises.map((e) => e.group ?? 0)) + 1;
  const joined = following.group;
  return normalizeGroups(
    exercises.map((exercise, position) => {
      const inFollowing = joined !== null ? exercise.group === joined && position > index : position === index + 1;
      return position === index || inFollowing ? { ...exercise, group } : exercise;
    }),
  );
}

/** "Remove from superset": the exercise leaves; the ones before and after it stay grouped. */
export function leaveGroup(exercises: DraftExercise[], index: number): DraftExercise[] {
  return normalizeGroups(exercises.map((exercise, position) => (position === index ? { ...exercise, group: null } : exercise)));
}

/** The indexes of the exercises in the same superset as `index` (just itself when alone). */
export function groupOf(exercises: DraftExercise[], index: number): number[] {
  const group = exercises[index]?.group;
  if (group === null || group === undefined) {
    return [index];
  }
  let start = index;
  while (start > 0 && exercises[start - 1].group === group) {
    start -= 1;
  }
  let end = index;
  while (end + 1 < exercises.length && exercises[end + 1].group === group) {
    end += 1;
  }
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

/** Sets of a superset in the order they are done: A1, B1, A2, B2, … */
export function roundOrder(exercises: DraftExercise[], members: number[]): { exercise: number; set: number }[] {
  const rounds = Math.max(0, ...members.map((member) => exercises[member].sets.length));
  const order: { exercise: number; set: number }[] = [];
  for (let set = 0; set < rounds; set += 1) {
    for (const exercise of members) {
      if (set < exercises[exercise].sets.length) {
        order.push({ exercise, set });
      }
    }
  }
  return order;
}

/** The set to do next in a superset, highlighted in the workout; none outside supersets. */
export function nextInSuperset(exercises: DraftExercise[], index: number): string | null {
  const members = groupOf(exercises, index);
  if (members.length < 2) {
    return null;
  }
  const next = roundOrder(exercises, members).find(({ exercise, set }) => !exercises[exercise].sets[set].done);
  return next ? exercises[next.exercise].sets[next.set].id : null;
}

/** Whether checking this set ends a round, which starts the rest; every set does outside supersets. */
export function endsRound(exercises: DraftExercise[], index: number, setIndex: number): boolean {
  const members = groupOf(exercises, index);
  const inRound = members.filter((member) => setIndex < exercises[member].sets.length);
  return inRound[inRound.length - 1] === index;
}

/**
 * Checks or unchecks a set. A checked set keeps the values it was saved with, so a later edit
 * of the set above cannot change it; checking starts the rest when it ends a round.
 * A set that cannot be checked yet is left as it is.
 */
export function toggleSet(draft: WorkoutDraft, index: number, setIndex: number, now: number): WorkoutDraft {
  const exercise = draft.exercises[index];
  const set = exercise?.sets[setIndex];
  if (!set) {
    return draft;
  }
  if (set.done) {
    return replaceSet(draft, index, setIndex, { ...set, done: false });
  }
  if (setProblems(set, exercise.weighted).length > 0) {
    return draft;
  }
  const { weightKg, reps } = effective(set);
  const checked = replaceSet(draft, index, setIndex, { ...set, weightKg, reps, done: true });
  return endsRound(draft.exercises, index, setIndex)
    ? { ...checked, rest: { endsAt: now + REST_SECONDS * 1000, seconds: REST_SECONDS } }
    : checked;
}

export function replaceSet(draft: WorkoutDraft, index: number, setIndex: number, set: DraftSet): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise, position) =>
      position === index
        ? { ...exercise, sets: exercise.sets.map((item, itemIndex) => (itemIndex === setIndex ? set : item)) }
        : exercise,
    ),
  };
}

/** "+30s" adds to the time left; the total shown ("of 120 seconds") grows with it. */
export function extendRest(rest: Rest, now: number): Rest {
  const endsAt = Math.max(rest.endsAt, now) + REST_STEP_SECONDS * 1000;
  return { endsAt, seconds: rest.seconds + REST_STEP_SECONDS };
}

export function restLeft(rest: Rest | null, now: number): number {
  return rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
}

export type Tally = { done: number; open: number; workingDone: number; volumeKg: number };

/** What the workout holds so far: checked and open sets, and the volume of the checked ones. */
export function tally(exercises: DraftExercise[]): Tally {
  const result: Tally = { done: 0, open: 0, workingDone: 0, volumeKg: 0 };
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (!set.done) {
        result.open += 1;
        continue;
      }
      result.done += 1;
      if (set.kind === 'working') {
        result.workingDone += 1;
        if (set.weightKg !== null && set.reps !== null) {
          result.volumeKg += set.weightKg * set.reps;
        }
      }
    }
  }
  return result;
}

/** Seconds since the start, at least 1 and at most 24 h, as the API allows. */
export function durationSeconds(startedAt: string, now: number): number {
  const seconds = Math.round((now - Date.parse(startedAt)) / 1000);
  return Math.min(MAX_DURATION_S, Math.max(1, seconds));
}

/**
 * The session to save on Finish: only checked sets, exercises without any dropped, positions
 * and supersets renumbered. Undefined while nothing is checked.
 */
export function toSession(draft: WorkoutDraft, now: number): SessionWrite | undefined {
  const kept = normalizeGroups(
    draft.exercises
      .map((exercise) => ({ ...exercise, sets: exercise.sets.filter((set) => set.done) }))
      .filter((exercise) => exercise.sets.length > 0),
  );
  if (kept.length === 0) {
    return undefined;
  }
  const name = draft.name.trim().slice(0, 60);
  return {
    tracker_id: draft.trackerId,
    started_at: draft.startedAt,
    local_date: draft.localDate,
    duration_s: durationSeconds(draft.startedAt, now),
    name: name || null,
    strength: {
      exercises: kept.map((exercise, position) => ({
        id: exercise.id,
        exercise_id: exercise.exerciseId,
        position,
        superset_group: exercise.group,
        sets: exercise.sets.map((set, setPosition) => ({
          position: setPosition,
          weight_kg: set.weightKg && set.weightKg > 0 ? round(set.weightKg, 4) : null,
          reps: set.reps ?? 0,
          kind: set.kind,
        })),
      })),
    },
  };
}

/** The session sent again with a new note (PUT replaces the session as a whole). */
export function withNote(body: SessionWrite, note: string): SessionWrite {
  return { ...body, note: note.trim() || null };
}

/** What Summary shows of a session: the server's numbers, or the device's own while it waits to be sent. */
export type SummaryFigures = {
  sessionId: string;
  trackerId: string;
  localDate: string;
  startedAt: string;
  name: string | null;
  durationS: number;
  volumeKg: number;
  workingSets: number;
  note: string | null;
};

export function summaryFigures(sessionId: string, body: SessionWrite, saved: SessionOut | null): SummaryFigures {
  let volumeKg = 0;
  let workingSets = 0;
  for (const entry of body.strength?.exercises ?? []) {
    for (const set of entry.sets) {
      if (set.kind === 'warmup') {
        continue;
      }
      workingSets += 1;
      if (set.weight_kg !== null && set.weight_kg !== undefined) {
        volumeKg += Number(set.weight_kg) * set.reps;
      }
    }
  }
  return {
    sessionId,
    trackerId: body.tracker_id,
    localDate: body.local_date,
    startedAt: body.started_at,
    name: saved?.name ?? body.name ?? null,
    durationS: saved?.duration_s ?? body.duration_s ?? 0,
    volumeKg: saved?.stats.volume_kg ?? volumeKg,
    workingSets: saved?.stats.working_sets ?? workingSets,
    note: body.note ?? null,
  };
}

/** A weight typed in the person's unit, in kg to 4 decimals; null when empty, undefined when unreadable. */
export function parseWeight(text: string, unit: WeightUnit): number | null | undefined {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return round(unit === 'lb' ? value * KG_PER_LB : value, 4);
}

/** A kg weight in the person's unit, to at most 2 decimals, for a field or the Previous column. */
export function weightIn(kg: number, unit: WeightUnit): number {
  return round(unit === 'lb' ? kg / KG_PER_LB : kg, 2);
}

/** Keeps what a weight field may hold: digits and one decimal separator with up to 2 decimals. */
export function cleanWeightText(text: string): string {
  let separator = false;
  let decimals = 0;
  let digits = 0;
  let result = '';
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      if (separator) {
        if (decimals === 2) {
          continue;
        }
        decimals += 1;
      } else if (digits === 4) {
        continue;
      } else {
        digits += 1;
      }
      result += char;
    } else if ((char === '.' || char === ',') && !separator) {
      separator = true;
      result += char;
    }
  }
  return result;
}

/** Keeps what a reps field may hold: up to 3 digits. */
export function cleanRepsText(text: string): string {
  return text.replace(/\D/g, '').slice(0, 3);
}

/** "18:42", "1:02:03": a stopwatch, as on the workout title. */
export function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}
