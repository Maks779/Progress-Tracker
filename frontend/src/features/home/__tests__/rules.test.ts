import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';

import { activeDays, firstName, nextGoal, pagesTarget, relativeDay, ringFor, ringMessage, weekDates } from '../rules';

function tracker(overrides: Partial<TrackerSummary>): TrackerSummary {
  return {
    id: 'gym',
    type: 'strength',
    name: 'Gym',
    description: null,
    color: 'strength',
    icon: 'dumbbell',
    general_mode: null,
    counter_unit: null,
    counter_unit_note: null,
    position: 0,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    session_count: 0,
    archived: false,
    ...overrides,
  };
}

function goal(overrides: Partial<GoalOut>, value = 0, target = 3): GoalOut {
  return {
    id: 'gym-weekly',
    tracker_id: 'gym',
    kind: 'frequency',
    period: 'week',
    metric: 'sessions',
    name: null,
    start_date: '2026-11-01',
    end_date: null,
    is_pinned: true,
    target,
    progress: { period_start: '2026-11-23', period_end: '2026-11-29', value, target, expected: null, status: 'on_track' },
    streak_weeks: 0,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

const GYM = tracker({});
const BOOKS = tracker({ id: 'books', type: 'reading', name: 'Reading', color: 'reading', icon: 'book-open', position: 1 });
const RUN = tracker({ id: 'run', type: 'cardio', name: 'Running', color: 'cardio', icon: 'activity', position: 2 });
const WATER = tracker({ id: 'water', type: 'general', name: 'Water', color: 'general', icon: 'droplet', position: 3, counter_unit: 'glasses' });

const GYM_WEEKLY = goal({}, 2, 3);
const BOOKS_WEEKLY = goal({ id: 'books-weekly', tracker_id: 'books', kind: 'amount', metric: 'pages', target: 60 }, 48, 60);
const RUN_WEEKLY = goal({ id: 'run-weekly', tracker_id: 'run', kind: 'amount', metric: 'distance', target: 15000 }, 0, 15000);
const WATER_DAILY = goal({ id: 'water-daily', tracker_id: 'water', kind: 'amount', period: 'day', metric: 'count', is_pinned: false, target: 8 }, 5, 8);

describe('ringFor', () => {
  it('shows the main tracker’s pinned weekly goal', () => {
    expect(ringFor('gym', [BOOKS_WEEKLY, GYM_WEEKLY], [GYM, BOOKS])).toEqual({ kind: 'goal', goal: GYM_WEEKLY, tracker: GYM });
  });

  it('invites to set a goal when the main tracker has none, even if others do', () => {
    expect(ringFor('gym', [BOOKS_WEEKLY], [GYM, BOOKS])).toEqual({ kind: 'noGoal', tracker: GYM });
  });

  it('ignores an unpinned or daily goal of the main tracker', () => {
    const daily = goal({ id: 'daily', period: 'day', kind: 'amount', is_pinned: false });
    expect(ringFor('gym', [daily], [GYM])).toEqual({ kind: 'noGoal', tracker: GYM });
  });

  it('falls back to the first tracker with a pinned weekly goal without a main tracker', () => {
    expect(ringFor(null, [RUN_WEEKLY, BOOKS_WEEKLY], [RUN, BOOKS])).toEqual({ kind: 'goal', goal: BOOKS_WEEKLY, tracker: BOOKS });
  });

  it('invites the first active tracker when no tracker has a weekly goal', () => {
    expect(ringFor(null, [WATER_DAILY], [WATER, RUN])).toEqual({ kind: 'noGoal', tracker: RUN });
  });

  it('skips archived trackers and shows nothing without an active one', () => {
    const archived = tracker({ archived: true });
    expect(ringFor('gym', [GYM_WEEKLY], [archived, BOOKS])).toEqual({ kind: 'noGoal', tracker: BOOKS });
    expect(ringFor('gym', [GYM_WEEKLY], [archived])).toEqual({ kind: 'none' });
    expect(ringFor(null, [], [])).toEqual({ kind: 'none' });
  });
});

describe('ringMessage', () => {
  it.each([
    [0, 3, 'frequency', 'zero'],
    [1, 3, 'frequency', 'more'],
    [2, 3, 'frequency', 'one'],
    [3, 3, 'frequency', 'met'],
    [4, 3, 'frequency', 'met'],
    [59, 60, 'amount', 'more'],
  ] as const)('%i of %i (%s) -> %s', (value, target, kind, expected) => {
    expect(ringMessage(goal({ kind }, value, target))).toBe(expected);
  });
});

describe('nextGoal', () => {
  const all = [GYM_WEEKLY, BOOKS_WEEKLY, RUN_WEEKLY, WATER_DAILY];
  const trackers = [GYM, BOOKS, RUN, WATER];

  it('picks the unmet goal closest to done, the ring’s goal aside', () => {
    expect(nextGoal(all, trackers, 'gym-weekly')).toEqual({ goal: BOOKS_WEEKLY, tracker: BOOKS, remaining: 12 });
  });

  it('skips met and cumulative goals and archived trackers', () => {
    const met = goal({ id: 'books-weekly', tracker_id: 'books', kind: 'amount', metric: 'pages' }, 60, 60);
    const cumulative = goal({ id: 'books-total', tracker_id: 'books', kind: 'cumulative', period: null, metric: 'books', is_pinned: false }, 19, 20);
    const archivedWater = { ...WATER, archived: true };
    expect(nextGoal([GYM_WEEKLY, met, cumulative, RUN_WEEKLY, WATER_DAILY], [GYM, BOOKS, RUN, archivedWater], 'gym-weekly')?.goal).toBe(RUN_WEEKLY);
  });

  it('breaks ties by tracker order and returns nothing when every goal is met', () => {
    const run = goal({ id: 'run-weekly', tracker_id: 'run', kind: 'amount', metric: 'distance' }, 1, 2);
    const books = goal({ id: 'books-weekly', tracker_id: 'books', kind: 'amount', metric: 'pages' }, 30, 60);
    expect(nextGoal([run, books], trackers)?.goal).toBe(books);
    expect(nextGoal([goal({}, 3, 3)], trackers)).toBeUndefined();
  });
});

describe('pagesTarget', () => {
  it('uses the one weekly pages goal of an active tracker', () => {
    expect(pagesTarget([GYM_WEEKLY, BOOKS_WEEKLY], [GYM, BOOKS])).toBe(60);
  });

  it('gives up when there is none or more than one', () => {
    const second = goal({ id: 'other', tracker_id: 'run', kind: 'amount', metric: 'pages', target: 30 });
    const daily = goal({ id: 'daily', tracker_id: 'books', kind: 'amount', period: 'day', metric: 'pages', target: 10 });
    expect(pagesTarget([BOOKS_WEEKLY, second], [BOOKS, RUN])).toBeUndefined();
    expect(pagesTarget([daily], [BOOKS])).toBeUndefined();
    expect(pagesTarget([BOOKS_WEEKLY], [{ ...BOOKS, archived: true }])).toBeUndefined();
  });
});

describe('week days', () => {
  it('lists the seven days from Monday, across a month and a clock change', () => {
    expect(weekDates('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(weekDates('2026-03-23').at(-1)).toBe('2026-03-29');
  });

  it('marks the days of one tracker, or of any', () => {
    const days = [
      { local_date: '2026-11-23', tracker_ids: ['gym'] },
      { local_date: '2026-11-24', tracker_ids: ['books'] },
      { local_date: '2026-11-26', tracker_ids: ['books', 'gym'] },
    ];
    expect([...activeDays(days, 'gym')]).toEqual(['2026-11-23', '2026-11-26']);
    expect(activeDays(days).size).toBe(3);
  });
});

describe('relativeDay', () => {
  it.each([
    ['2026-11-26', 'today'],
    ['2026-11-27', 'today'],
    ['2026-11-25', 'yesterday'],
    ['2026-11-20', 'week'],
    ['2026-11-19', 'older'],
  ] as const)('%s seen on 2026-11-26 -> %s', (day, expected) => {
    expect(relativeDay(day, '2026-11-26')).toBe(expected);
  });

  it('counts calendar days across the clock change', () => {
    expect(relativeDay('2026-03-28', '2026-03-29')).toBe('yesterday');
  });
});

describe('firstName', () => {
  it.each([
    ['Alex Morgan', 'Alex'],
    ['  Олександр Мороз ', 'Олександр'],
    ['Alex', 'Alex'],
  ])('%s -> %s', (name, expected) => {
    expect(firstName(name)).toBe(expected);
  });
});
