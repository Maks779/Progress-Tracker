import { renderHook } from '@testing-library/react-native';

import { usePreferences } from '@/features/settings/preferences';
import type { GoalOut } from '@/shared/api/generated/model';
import i18n from '@/shared/i18n';

import { useGoalText } from '../format';

const GYM = { name: 'Gym', counter_unit: null };
const WATER = { name: 'Water', counter_unit: 'glasses' };

function goal(overrides: Partial<GoalOut>, value: number, target: number): GoalOut {
  return {
    id: 'g',
    tracker_id: 't',
    kind: 'frequency',
    period: 'week',
    metric: 'sessions',
    name: null,
    start_date: '2026-01-01',
    end_date: null,
    is_pinned: true,
    target,
    progress: { period_start: '2026-11-23', period_end: '2026-11-29', value, target, expected: null, status: 'on_track' },
    streak_weeks: 0,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

async function text(language: string, distance: 'km' | 'mi' = 'km') {
  await i18n.changeLanguage(language);
  usePreferences.setState((state) => ({ values: { ...state.values, distance_unit: distance } }));
  return (await renderHook(() => useGoalText())).result.current;
}

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('goal text', () => {
  it('writes progress like the design', async () => {
    const en = await text('en');

    expect(en.progress(goal({}, 2, 3), GYM)).toBe('2 / 3 sessions');
    expect(en.progress(goal({ kind: 'amount', metric: 'distance' }, 8400, 15000), GYM)).toBe('8.4 / 15 km');
    expect(en.progress(goal({ kind: 'amount', period: 'day', metric: 'count' }, 3, 8), WATER)).toBe('3 / 8 glasses');
    expect(en.progress(goal({ kind: 'amount', metric: 'duration' }, 2700, 9000), GYM)).toBe('45 / 150 min');
    expect(en.progress(goal({ kind: 'cumulative', period: null, metric: 'books' }, 14, 20), GYM)).toBe('14 / 20 books · 70%');
  });

  it('gives the tracker row a short target', async () => {
    const en = await text('en');

    expect(en.short(goal({}, 0, 3), GYM)).toBe('3 / week');
    expect(en.short(goal({ kind: 'amount', metric: 'distance' }, 0, 12000), GYM)).toBe('12 km / week');
    expect(en.short(goal({ kind: 'amount', period: 'day', metric: 'count' }, 0, 8), WATER)).toBe('8 glasses / day');
    expect(en.short(goal({ kind: 'amount', metric: 'pages' }, 0, 1), GYM)).toBe('1 page / week');
  });

  it('says when the period resets or the goal ends', async () => {
    const en = await text('en');
    const total = goal({ kind: 'cumulative', period: null, metric: 'books', end_date: '2026-12-31' }, 0, 20);

    expect(en.footer(goal({}, 0, 3), '2026-11-26')).toBe('Weekly · Resets Monday');
    expect(en.footer(goal({ kind: 'amount', period: 'day', metric: 'count' }, 0, 8), '2026-11-26')).toBe(
      'Daily · Starts fresh each day',
    );
    expect(en.footer(total, '2026-11-26')).toBe('Cumulative · Ends Dec 31, 2026');
    expect(en.footer(total, '2027-01-02')).toBe('Cumulative · Ended Dec 31, 2026');
  });

  it('follows the distance unit setting', async () => {
    const en = await text('en', 'mi');

    expect(en.progress(goal({ kind: 'amount', metric: 'distance' }, 8047, 16093), GYM)).toBe('5 / 10 mi');
    expect(en.targetUnit('amount', 'week', 'distance', GYM)).toBe('mi / week');
  });

  it('uses Polish and Ukrainian plural forms', async () => {
    const pl = await text('pl');
    expect(pl.progress(goal({}, 2, 5), GYM)).toBe('2 / 5 sesji');
    expect(pl.progress(goal({}, 1, 3), GYM)).toBe('1 / 3 sesje');
    expect(pl.short(goal({ kind: 'amount', metric: 'pages' }, 0, 22), GYM)).toBe('22 strony / tydzień');

    const uk = await text('uk', 'mi');
    expect(uk.progress(goal({ kind: 'amount', metric: 'distance' }, 0, 8047), GYM)).toBe('0 / 5 миль');
    expect(uk.progress(goal({ kind: 'amount', metric: 'distance' }, 0, 3219), GYM)).toBe('0 / 2 милі');
    expect(uk.progress(goal({ kind: 'cumulative', period: null, metric: 'books' }, 1, 21), GYM)).toBe('1 / 21 книга · 4%');
  });
});
