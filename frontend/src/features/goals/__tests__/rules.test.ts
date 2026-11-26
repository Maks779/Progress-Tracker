import type { GoalOut } from '@/shared/api/generated/model';

import {
  fromCanonical,
  headlineGoal,
  initialTarget,
  kindsFor,
  metricsFor,
  parseTarget,
  share,
  toCanonical,
  visibleGoals,
} from '../rules';

function goal(overrides: Partial<GoalOut>): GoalOut {
  return {
    id: 'g',
    tracker_id: 't',
    kind: 'frequency',
    period: 'week',
    metric: 'sessions',
    name: null,
    start_date: '2026-11-01',
    end_date: null,
    is_pinned: false,
    target: 3,
    progress: { period_start: '2026-11-23', period_end: '2026-11-29', value: 1, target: 3, expected: null, status: 'on_track' },
    streak_weeks: 0,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

describe('which goals a tracker can have', () => {
  it('offers strength trackers frequency and cumulative goals only', () => {
    expect(kindsFor({ type: 'strength', general_mode: null })).toEqual(['frequency', 'cumulative']);
    expect(kindsFor({ type: 'cardio', general_mode: null })).toEqual(['frequency', 'amount', 'cumulative']);
  });

  it('matches the metrics the API accepts for every type and kind', () => {
    const cardio = { type: 'cardio', general_mode: null } as const;
    const reading = { type: 'reading', general_mode: null } as const;
    const counter = { type: 'general', general_mode: 'counter' } as const;
    const minutes = { type: 'general', general_mode: 'duration' } as const;

    expect(metricsFor(cardio, 'frequency')).toEqual(['sessions']);
    expect(metricsFor(cardio, 'amount')).toEqual(['distance', 'duration']);
    expect(metricsFor(reading, 'amount')).toEqual(['pages', 'duration']);
    expect(metricsFor(counter, 'amount')).toEqual(['count']);
    expect(metricsFor(minutes, 'amount')).toEqual(['duration']);
    expect(metricsFor({ type: 'strength', general_mode: null }, 'cumulative')).toEqual(['sessions']);
    expect(metricsFor(cardio, 'cumulative')).toEqual(['distance', 'duration', 'sessions']);
    expect(metricsFor(reading, 'cumulative')).toEqual(['books', 'pages', 'duration']);
    expect(metricsFor(counter, 'cumulative')).toEqual(['count', 'sessions']);
  });

  it('starts from a sensible target for each kind', () => {
    expect(initialTarget('frequency', 'week', 'sessions')).toBe(3);
    expect(initialTarget('amount', 'day', 'duration')).toBe(30);
    expect(initialTarget('amount', 'week', 'distance')).toBe(15);
    expect(initialTarget('cumulative', 'week', 'books')).toBe(12);
  });
});

describe('targets in the units people type', () => {
  it('reads decimals for distance only, with a comma or a dot', () => {
    expect(parseTarget('12,5', 'distance')).toBe(12.5);
    expect(parseTarget(' 7.25 ', 'distance')).toBe(7.25);
    expect(parseTarget('7.255', 'distance')).toBeNull();
    expect(parseTarget('12.5', 'pages')).toBeNull();
    expect(parseTarget('0', 'pages')).toBeNull();
    expect(parseTarget('-3', 'count')).toBeNull();
    expect(parseTarget('abc', 'books')).toBeNull();
    expect(parseTarget('60', 'duration')).toBe(60);
  });

  it('stores metres and seconds, and shows them back in km, mi and minutes', () => {
    expect(toCanonical('distance', 12.5, 'km')).toBe(12500);
    expect(toCanonical('distance', 10, 'mi')).toBe(16093);
    expect(fromCanonical('distance', 16093, 'mi')).toBe(10);
    expect(fromCanonical('distance', 5200, 'km')).toBe(5.2);
    expect(toCanonical('duration', 45, 'km')).toBe(2700);
    expect(fromCanonical('duration', 2892, 'km')).toBe(48);
    expect(toCanonical('pages', 60, 'mi')).toBe(60);
  });

  it('fills the bar by the share reached, never past full', () => {
    expect(share(goal({}))).toBeCloseTo(1 / 3);
    expect(share(goal({ progress: { ...goal({}).progress, value: 5 } }))).toBe(1);
  });
});

describe('which goals show where', () => {
  const gym = { id: 'gym' };
  const run = { id: 'run' };

  it('lists goals in tracker order, pinned first, and hides goals of other trackers', () => {
    const goals = [
      goal({ id: 'run-weekly', tracker_id: 'run', is_pinned: true }),
      goal({ id: 'gym-total', tracker_id: 'gym', kind: 'cumulative', period: null }),
      goal({ id: 'archived', tracker_id: 'old' }),
      goal({ id: 'gym-weekly', tracker_id: 'gym', is_pinned: true }),
    ];

    expect(visibleGoals(goals, [gym, run]).map((item) => item.id)).toEqual(['gym-weekly', 'gym-total', 'run-weekly']);
  });

  it('shows the pinned goal in the tracker row, else its first daily or weekly goal', () => {
    const daily = goal({ id: 'daily', tracker_id: 'gym', period: 'day', kind: 'amount' });
    const pinned = goal({ id: 'pinned', tracker_id: 'gym', is_pinned: true });
    const total = goal({ id: 'total', tracker_id: 'run', kind: 'cumulative', period: null });

    expect(headlineGoal([daily, pinned], 'gym')?.id).toBe('pinned');
    expect(headlineGoal([daily], 'gym')?.id).toBe('daily');
    expect(headlineGoal([total], 'run')).toBeUndefined();
  });
});
