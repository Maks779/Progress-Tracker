import { addDays, weekOf } from '@/features/history/rules';
import type { ExerciseOut, ExerciseRecords, RecordOut } from '@/shared/api/generated/model';

/** The rules of Progress (spec §3.4, §3.14) as pure functions: scales, labels, the consistency grid, records. */

export type Period = '4w' | '3m' | '1y' | 'all';

export const PERIODS: Period[] = ['4w', '3m', '1y', 'all'];

const PERIOD_WEEKS: Record<Exclude<Period, 'all'>, number> = { '4w': 4, '3m': 13, '1y': 52 };

/** At most this many weeks of the consistency grid are drawn: a year, so it stays readable on a phone. */
export const GRID_WEEKS = 53;

const STEPS = [1, 2, 2.5, 5];

/**
 * Three round values for a chart's side ("45, 55, 65", as in the design): evenly apart by the
 * smallest round step that covers the values (at least a tenth of them, so a change of 2.5 kg
 * on 100 kg stays modest), starting at a multiple of half that step. Values that barely change
 * sit in the middle rather than on the bottom line.
 */
export function axisTicks(values: number[]): [number, number, number] {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, Math.abs(high) * 0.1, 1);
  const base = 10 ** Math.floor(Math.log10(span / 2));
  const steps = [...STEPS.map((factor) => factor * base), ...STEPS.map((factor) => factor * base * 10), 100 * base];
  for (const step of steps.filter((candidate) => 2 * candidate >= span)) {
    const half = step / 2;
    const middle = (low + high) / 2;
    const bottom = high - low <= half ? Math.floor((middle - step) / half) * half : Math.floor(low / half) * half;
    if (bottom <= low && bottom + 2 * step >= high) {
      return [bottom, bottom + step, bottom + 2 * step];
    }
  }
  return [low, (low + high) / 2, high];
}

/** The positions of a line's points in a box, the first at the left edge and the last at the right. */
export function linePositions(values: number[], width: number, height: number, ticks: [number, number, number]): { x: number; y: number }[] {
  const [bottom, , top] = ticks;
  const range = top - bottom || 1;
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: height - ((value - bottom) / range) * height,
  }));
}

/** Which points get a date under the chart: the first, the last and evenly between, at most `count`. */
export function labelIndexes(length: number, count = 4): number[] {
  if (length <= count) {
    return Array.from({ length }, (_, index) => index);
  }
  return Array.from({ length: count }, (_, index) => Math.round((index * (length - 1)) / (count - 1)));
}

/** "6.0k", "10.3k", "940": short enough to sit under a bar without wrapping (design §7.2). */
export function compactNumber(value: number, language: string): string {
  if (Math.abs(value) < 1000) {
    return new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(value);
  }
  return `${new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 1000)}k`;
}

/** The first day of a period, as the API counts it: 4W, 3M and 1Y end with this week, All starts at the first session. */
export function periodStart(period: Period, today: string, firstDay: string | undefined): string {
  if (period === 'all') {
    return firstDay && firstDay < today ? firstDay : today;
  }
  return addDays(weekOf(today).from, -7 * (PERIOD_WEEKS[period] - 1));
}

export type GridDay = { date: string; active: boolean } | null;

/**
 * The consistency grid (spec §3.14): a column per week, Monday at the top; days outside the
 * period are empty cells. Only the last `GRID_WEEKS` weeks are drawn.
 */
export function consistencyGrid(activeDays: string[], start: string, end: string): GridDay[][] {
  const active = new Set(activeDays);
  const weeks: GridDay[][] = [];
  for (let monday = weekOf(start).from; monday <= end; monday = addDays(monday, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(monday, index);
        return date < start || date > end ? null : { date, active: active.has(date) };
      }),
    );
  }
  return weeks.slice(-GRID_WEEKS);
}

/** Exercises the person has done, most recently done first: the ones the line can show. */
export function doneExercises(catalog: ExerciseOut[]): ExerciseOut[] {
  return catalog
    .filter((exercise) => exercise.last_used_date)
    .sort((a, b) => (b.last_used_date ?? '').localeCompare(a.last_used_date ?? '') || a.id.localeCompare(b.id));
}

/** Epley, as the API counts it (spec §3.4): the weight itself for 1 rep, none above 10 reps. */
export function estimatedMax(weightKg: number, reps: number): number | null {
  if (reps === 1) {
    return weightKg;
  }
  return reps > 10 ? null : (weightKg * (30 + reps)) / 30;
}

type LoggedSet = { weightKg: number | null; reps: number };
type RecordType = RecordOut['record_type'];

const TYPES: RecordType[] = ['max_weight', 'max_reps', 'estimated_1rm'];
const EPSILON = 1e-9;

function score(type: RecordType, set: LoggedSet): number[] | null {
  if (type === 'max_weight') {
    return set.weightKg === null ? null : [set.weightKg];
  }
  if (type === 'max_reps') {
    return [set.reps, set.weightKg ?? 0];
  }
  const estimate = set.weightKg === null ? null : estimatedMax(set.weightKg, set.reps);
  return estimate === null ? null : [estimate];
}

function beats(a: number[], b: number[]): boolean {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] > b[index] + EPSILON) {
      return true;
    }
    if (a[index] < b[index] - EPSILON) {
      return false;
    }
  }
  return false;
}

function previousScore(type: RecordType, record: RecordOut | null | undefined): number[] | null {
  if (!record) {
    return null;
  }
  return type === 'max_reps' ? [record.reps, record.weight_kg ?? 0] : [record.value];
}

export type LiveRecord = { recordType: RecordType; value: number; weightKg: number | null; reps: number };

/**
 * The records completed working sets set over the exercise's current bests, with the API's
 * rules (spec §3.4): the best set per kind, strictly higher, ties never count, and an exercise
 * without any best yet is the baseline, which sets none. Used live in the workout and on an
 * offline Summary, until the server's answer.
 */
export function newRecords(bests: Pick<ExerciseRecords, 'max_weight' | 'max_reps' | 'estimated_1rm'> | undefined, sets: LoggedSet[]): LiveRecord[] {
  if (!bests || (!bests.max_weight && !bests.max_reps && !bests.estimated_1rm)) {
    return [];
  }
  const found: LiveRecord[] = [];
  for (const type of TYPES) {
    let winner: LoggedSet | null = null;
    let winnerScore: number[] | null = null;
    for (const set of sets) {
      const current = score(type, set);
      if (current && (!winnerScore || beats(current, winnerScore))) {
        winner = set;
        winnerScore = current;
      }
    }
    const before = previousScore(type, bests[type]);
    if (winner && winnerScore && (!before || beats(winnerScore, before))) {
      const value = type === 'max_weight' ? (winner.weightKg ?? 0) : type === 'max_reps' ? winner.reps : (estimatedMax(winner.weightKg ?? 0, winner.reps) ?? 0);
      found.push({ recordType: type, value, weightKg: winner.weightKg, reps: winner.reps });
    }
  }
  return found;
}
