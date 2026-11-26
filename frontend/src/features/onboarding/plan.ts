import type { GoalCreate, TrackerCreate } from '@/shared/api/generated/model';

export type TrackerKind = 'strength' | 'cardio' | 'reading' | 'general';

export const KINDS: TrackerKind[] = ['strength', 'cardio', 'reading', 'general'];

type Rule = {
  metric: 'sessions' | 'pages';
  initial: number;
  min: number;
  max: number;
  step: number;
  icon: TrackerCreate['icon'];
};

/**
 * The starting weekly goal for each kind: workouts and habits count sessions (1–7 a week),
 * reading counts pages (10–500 a week, in tens). The first weekly goal of a tracker becomes
 * its pinned goal on the server.
 */
export const RULES: Record<TrackerKind, Rule> = {
  strength: { metric: 'sessions', initial: 3, min: 1, max: 7, step: 1, icon: 'dumbbell' },
  cardio: { metric: 'sessions', initial: 3, min: 1, max: 7, step: 1, icon: 'activity' },
  reading: { metric: 'pages', initial: 60, min: 10, max: 500, step: 10, icon: 'book-open' },
  general: { metric: 'sessions', initial: 3, min: 1, max: 7, step: 1, icon: 'sparkles' },
};

export type Targets = Record<TrackerKind, number>;

export function initialTargets(): Targets {
  return {
    strength: RULES.strength.initial,
    cardio: RULES.cardio.initial,
    reading: RULES.reading.initial,
    general: RULES.general.initial,
  };
}

export function stepTarget(kind: TrackerKind, value: number, direction: 1 | -1): number {
  const { min, max, step } = RULES[kind];
  return Math.min(max, Math.max(min, value + direction * step));
}

/** A general tracker starts in duration mode: it needs no unit, and a session is any time spent. */
export function trackerBody(kind: TrackerKind, name: string): TrackerCreate {
  return {
    type: kind,
    name,
    color: kind,
    icon: RULES[kind].icon,
    ...(kind === 'general' ? { general_mode: 'duration' as const } : {}),
  };
}

export function goalBody(kind: TrackerKind, trackerId: string, target: number): GoalCreate {
  const metric = RULES[kind].metric;
  return {
    tracker_id: trackerId,
    kind: metric === 'sessions' ? 'frequency' : 'amount',
    period: 'week',
    metric,
    target,
    is_pinned: true,
  };
}
