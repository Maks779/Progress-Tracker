import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';

export type GoalKind = 'frequency' | 'amount' | 'cumulative';
export type GoalPeriod = 'day' | 'week';
export type Metric = 'sessions' | 'distance' | 'duration' | 'pages' | 'count' | 'books';
export type DistanceUnit = 'km' | 'mi';

type TrackerShape = Pick<TrackerSummary, 'type' | 'general_mode'>;

const METRES = { km: 1000, mi: 1609.344 } as const;

/** Frequency targets on the stepper: one to seven sessions a week, as in onboarding. */
export const FREQUENCY = { min: 1, max: 7, initial: 3 } as const;

/** The largest target the API accepts, in canonical units. */
export const MAX_TARGET = 100_000_000;

/** Strength trackers have no amount to sum up, so they offer only frequency and cumulative goals. */
export function kindsFor(tracker: TrackerShape): GoalKind[] {
  return tracker.type === 'strength' ? ['frequency', 'cumulative'] : ['frequency', 'amount', 'cumulative'];
}

/**
 * The metrics a goal of this kind can count for this tracker, most natural first. Mirrors the
 * API's rules: a general tracker counts minutes or its own unit, depending on its mode.
 */
export function metricsFor(tracker: TrackerShape, kind: GoalKind): Metric[] {
  const general: Metric = tracker.general_mode === 'counter' ? 'count' : 'duration';
  if (kind === 'frequency') {
    return ['sessions'];
  }
  if (kind === 'amount') {
    return { strength: [], cardio: ['distance', 'duration'], reading: ['pages', 'duration'], general: [general] }[
      tracker.type
    ] as Metric[];
  }
  return {
    strength: ['sessions'],
    cardio: ['distance', 'duration', 'sessions'],
    reading: ['books', 'pages', 'duration'],
    general: [general, 'sessions'],
  }[tracker.type] as Metric[];
}

/** A sensible first target, in the units the person types (km or mi, minutes). */
export function initialTarget(kind: GoalKind, period: GoalPeriod, metric: Metric): number {
  if (kind === 'frequency') {
    return FREQUENCY.initial;
  }
  if (kind === 'amount') {
    const daily = period === 'day';
    return { sessions: 1, distance: daily ? 5 : 15, duration: daily ? 30 : 150, pages: daily ? 20 : 100, count: daily ? 8 : 50, books: 1 }[
      metric
    ];
  }
  return { sessions: 50, distance: 100, duration: 1000, pages: 3000, count: 500, books: 12 }[metric];
}

/** Distance is typed in km or mi with up to two decimals; everything else is a whole number. */
export function parseTarget(text: string, metric: Metric): number | null {
  const normalized = text.trim().replace(',', '.');
  const pattern = metric === 'distance' ? /^\d+(\.\d{1,2})?$/ : /^\d+$/;
  if (!pattern.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return value > 0 ? value : null;
}

/** The value the API stores: metres for distance, seconds for duration. */
export function toCanonical(metric: Metric, value: number, unit: DistanceUnit): number {
  if (metric === 'distance') {
    return Math.round(value * METRES[unit]);
  }
  if (metric === 'duration') {
    return Math.round(value * 60);
  }
  return Math.round(value);
}

/** The API's value in the units shown: km or mi with up to two decimals, whole minutes. */
export function fromCanonical(metric: Metric, value: number, unit: DistanceUnit): number {
  if (metric === 'distance') {
    return Math.round((value / METRES[unit]) * 100) / 100;
  }
  if (metric === 'duration') {
    return Math.round(value / 60);
  }
  return value;
}

export function isWeekly(goal: Pick<GoalOut, 'period'>): boolean {
  return goal.period === 'week';
}

/** Share of the target reached, 0–1, for the progress bar. */
export function share(goal: Pick<GoalOut, 'progress'>): number {
  const { value, target } = goal.progress;
  return target > 0 ? Math.min(1, value / target) : 0;
}

/** The goal a tracker row shows: the pinned weekly goal, else its first daily or weekly goal. */
export function headlineGoal(goals: GoalOut[], trackerId: string): GoalOut | undefined {
  const own = goals.filter((goal) => goal.tracker_id === trackerId && goal.kind !== 'cumulative');
  return own.find((goal) => goal.is_pinned) ?? own[0];
}

/**
 * The goals to list: only those of the given (active) trackers, in the trackers' order, each
 * tracker's pinned goal first, the rest as created. Goals of archived trackers stay hidden.
 */
export function visibleGoals(goals: GoalOut[], trackers: Pick<TrackerSummary, 'id'>[]): GoalOut[] {
  const order = new Map(trackers.map((tracker, index) => [tracker.id, index]));
  return goals
    .filter((goal) => order.has(goal.tracker_id))
    .map((goal, index) => ({ goal, index }))
    .sort(
      (a, b) =>
        order.get(a.goal.tracker_id)! - order.get(b.goal.tracker_id)! ||
        Number(b.goal.is_pinned) - Number(a.goal.is_pinned) ||
        a.index - b.index,
    )
    .map(({ goal }) => goal);
}
