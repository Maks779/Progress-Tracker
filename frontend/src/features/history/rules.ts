import { infoOf, isWeighted } from '@/features/workout/exercises';
import { type DraftExercise, effective, normalizeGroups, setProblems, type WorkoutDraft } from '@/features/workout/rules';
import type { ExerciseOut, SessionOut, SessionWrite, StrengthEntryOut, StrengthSetOut, TrackerSummary } from '@/shared/api/generated/model';
import { parseIsoDate, toIsoDate } from '@/shared/format/dates';

/** The rules of History (spec §3.2, F11) as pure functions: the month, the week, the filter, a session. */

export type TrackerType = 'strength' | 'cardio' | 'reading' | 'general';

/** Marker shapes in the calendar, in this order (design §2.5): ● strength, ◆ cardio, ■ reading, + general. */
export const TYPE_ORDER: TrackerType[] = ['strength', 'cardio', 'reading', 'general'];

/** "2026-10" for any day of October 2026. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + number - 1 + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The days of a month in weeks, Monday first; the cells before the 1st and after the last day are empty. */
export function monthGrid(month: string): (string | null)[][] {
  const [year, number] = month.split('-').map(Number);
  const length = new Date(year, number, 0).getDate();
  const blanks = (new Date(year, number - 1, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: blanks }, () => null);
  for (let day = 1; day <= length; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (string | null)[][] = [];
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7));
  }
  return weeks;
}

export function addDays(date: string, days: number): string {
  const day = parseIsoDate(date);
  return toIsoDate(new Date(day.getFullYear(), day.getMonth(), day.getDate() + days));
}

export type Week = { from: string; to: string };

/** The ISO week (Monday to Sunday, design §7.2) a day belongs to. */
export function weekOf(date: string): Week {
  const offset = (parseIsoDate(date).getDay() + 6) % 7;
  const from = addDays(date, -offset);
  return { from, to: addDays(from, 6) };
}

/** Whether a week is this week, last week, or another one, for its title. */
export function weekKind(week: Week, today: string): 'this' | 'last' | 'other' {
  const current = weekOf(today).from;
  if (week.from === current) {
    return 'this';
  }
  return week.from === addDays(current, -7) ? 'last' : 'other';
}

/**
 * The tracker filter (design: All trackers · Gym · Reading · More): all trackers when they fit
 * in three segments, else the first two and More for the rest. Active trackers come first in
 * their order, then archived ones, whose sessions stay in History.
 */
export function filterGroups(trackers: TrackerSummary[], visible = 2): { shown: TrackerSummary[]; rest: TrackerSummary[] } {
  const ordered = [...trackers].sort((a, b) => Number(a.archived) - Number(b.archived) || a.position - b.position);
  if (ordered.length <= visible + 1) {
    return { shown: ordered, rest: [] };
  }
  return { shown: ordered.slice(0, visible), rest: ordered.slice(visible) };
}

/** What a session is called: its name, else its book's title, else its tracker's name (as the API lists it). */
export function sessionTitle(
  session: Pick<SessionOut, 'name' | 'reading'>,
  tracker: Pick<TrackerSummary, 'name'> | undefined,
  bookTitle: string | undefined,
): string {
  return session.name || (session.reading ? bookTitle : undefined) || tracker?.name || '';
}

/** A saved workout's cards: the exercises of a superset share one, every other exercise has its own. */
export function entryCards(entries: StrengthEntryOut[]): StrengthEntryOut[][] {
  const ordered = [...entries].sort((a, b) => a.position - b.position);
  const cards: StrengthEntryOut[][] = [];
  for (const entry of ordered) {
    const last = cards[cards.length - 1];
    if (last && entry.superset_group !== null && last[0].superset_group === entry.superset_group) {
      last.push(entry);
    } else {
      cards.push([entry]);
    }
  }
  return cards;
}

export function sortedSets(sets: StrengthSetOut[]): StrengthSetOut[] {
  return [...sets].sort((a, b) => a.position - b.position);
}

/** Working sets with a weight count towards volume (spec §3.3); warm-ups never do. */
export function setsVolume(sets: StrengthSetOut[]): number {
  return sets.reduce((sum, set) => (set.kind === 'working' && set.weight_kg !== null ? sum + set.weight_kg * set.reps : sum), 0);
}

export function workingSetCount(sets: StrengthSetOut[]): number {
  return sets.filter((set) => set.kind === 'working').length;
}

/**
 * "3 × 10 at 50 kg": an exercise whose sets are all working sets with the same weight and
 * reps reads as one line (design: Session detail); null when they differ, a warm-up is among
 * them, or there is a single set.
 */
export function sameSets(sets: StrengthSetOut[]): { count: number; reps: number; weightKg: number | null } | null {
  if (sets.length < 2 || sets.some((set) => set.kind !== 'working')) {
    return null;
  }
  const [first] = sets;
  return sets.every((set) => set.reps === first.reps && set.weight_kg === first.weight_kg)
    ? { count: sets.length, reps: first.reps, weightKg: first.weight_kg }
    : null;
}

/**
 * A saved workout as an editable draft (decision #18: the active-workout editor). Every set
 * keeps its values and counts; an exercise is weighted when the catalog says so and every one
 * of its sets has a weight, so an old set without one never blocks saving.
 */
export function draftFromSession(
  session: SessionOut,
  userId: string,
  catalog: Map<string, ExerciseOut>,
  newId: () => string,
): WorkoutDraft {
  const entries = [...(session.strength?.exercises ?? [])].sort((a, b) => a.position - b.position);
  const exercises: DraftExercise[] = entries.map((entry) => {
    const exercise = catalog.get(entry.exercise_id);
    const sets = sortedSets(entry.sets);
    return {
      id: entry.id,
      exerciseId: entry.exercise_id,
      info: infoOf(exercise),
      group: entry.superset_group,
      weighted: isWeighted(exercise) && sets.every((set) => set.weight_kg !== null),
      previous: [],
      sets: sets.map((set) => ({ id: newId(), kind: set.kind, weightKg: set.weight_kg, reps: set.reps, ghost: null, done: false })),
    };
  });
  return {
    version: 1,
    id: session.id,
    userId,
    trackerId: session.tracker_id,
    name: session.name ?? '',
    startedAt: session.started_at,
    localDate: session.local_date,
    exercises,
    rest: null,
  };
}

export type StrengthEditProblem = 'empty' | 'sets' | 'duration' | 'name';

export const MAX_NAME = 60;

/** What keeps an edited workout from being saved: no exercise left, a set without its values, a duration out of range. */
export function strengthProblems(draft: WorkoutDraft, durationMinutes: string): StrengthEditProblem[] {
  const problems: StrengthEditProblem[] = [];
  if (draft.exercises.every((exercise) => exercise.sets.length === 0)) {
    problems.push('empty');
  }
  if (draft.exercises.some((exercise) => exercise.sets.some((set) => setProblems(set, exercise.weighted).length > 0))) {
    problems.push('sets');
  }
  const minutes = durationMinutes.trim();
  if (!/^\d+$/.test(minutes) || Number(minutes) < 1 || Number(minutes) > 1440) {
    problems.push('duration');
  }
  if (draft.name.trim().length > MAX_NAME) {
    problems.push('name');
  }
  return problems;
}

/**
 * The edited workout as the session to save (PUT replaces it as a whole): every set with its
 * values, exercises without sets left out, supersets renumbered. The day and time stay as they
 * were unless `when` moves them.
 */
export function editedStrength(
  draft: WorkoutDraft,
  durationMinutes: string,
  note: string,
  when: { startedAt: string; localDate: string },
): SessionWrite {
  const kept = normalizeGroups(draft.exercises.filter((exercise) => exercise.sets.length > 0));
  return {
    tracker_id: draft.trackerId,
    started_at: when.startedAt,
    local_date: when.localDate,
    duration_s: Number(durationMinutes.trim()) * 60,
    name: draft.name.trim() || null,
    note: note.trim() || null,
    strength: {
      exercises: kept.map((exercise, position) => ({
        id: exercise.id,
        exercise_id: exercise.exerciseId,
        position,
        superset_group: exercise.group,
        sets: exercise.sets.map((set, setPosition) => {
          const values = effective(set);
          return { position: setPosition, weight_kg: values.weightKg, reps: values.reps ?? 0, kind: set.kind };
        }),
      })),
    },
  };
}

/** The week of a session counts for this week's goals only while it is this week. */
export function inWeek(localDate: string, week: Week): boolean {
  return localDate >= week.from && localDate <= week.to;
}
