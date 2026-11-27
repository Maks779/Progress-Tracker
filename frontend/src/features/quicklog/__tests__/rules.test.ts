import type { GoalOut } from '@/shared/api/generated/model';

import {
  distanceText,
  endPageFor,
  formatDuration,
  kindOf,
  openBooks,
  paceSeconds,
  pagesReadFor,
  parseDistance,
  parseDuration,
  prefill,
  problemsOf,
  type QuickForm,
  sideGoal,
  startedAt,
  toSession,
} from '../rules';

const NOW = new Date(2026, 9, 26, 18, 30);

function form(overrides: Partial<QuickForm> = {}): QuickForm {
  return {
    durationText: '',
    distanceText: '',
    minutesText: '',
    count: 1,
    pagesReadText: '',
    endPageText: '',
    note: '',
    date: '2026-10-26',
    time: '18:30',
    ...overrides,
  };
}

function goal(overrides: Partial<GoalOut>): GoalOut {
  return { id: 'g', tracker_id: 'run', kind: 'frequency', period: 'week', is_pinned: false, ...overrides } as GoalOut;
}

describe('which form a tracker logs with', () => {
  it('follows the type and, for general trackers, the mode', () => {
    expect(kindOf({ type: 'cardio', general_mode: null })).toBe('cardio');
    expect(kindOf({ type: 'reading', general_mode: null })).toBe('reading');
    expect(kindOf({ type: 'general', general_mode: 'duration' })).toBe('duration');
    expect(kindOf({ type: 'general', general_mode: 'counter' })).toBe('counter');
    expect(kindOf({ type: 'strength', general_mode: null })).toBeNull();
  });
});

describe('durations and distances as typed', () => {
  it('reads minutes, minutes and seconds, or hours, minutes and seconds', () => {
    expect(parseDuration('32')).toBe(1920);
    expect(parseDuration('32:30')).toBe(1950);
    expect(parseDuration('1:05:00')).toBe(3900);
    expect(parseDuration('00:32:00')).toBe(1920);
    expect(parseDuration('90:00')).toBe(5400);
    expect(parseDuration('32.30')).toBe(1950);
    expect(parseDuration('1,05,00')).toBe(3900);
    expect(parseDuration('  ')).toBeNull();
    for (const wrong of ['32:75', '1:60:00', 'abc', '1:2:3:4', '-5', '45.5', '45:5']) {
      expect(parseDuration(wrong)).toBeUndefined();
    }
    expect(formatDuration(1920)).toBe('32:00');
    expect(formatDuration(3905)).toBe('1:05:05');
  });

  it('turns km or mi with a comma or a dot into metres, and back', () => {
    expect(parseDistance('5.2', 'km')).toBe(5200);
    expect(parseDistance('5,2', 'km')).toBe(5200);
    expect(parseDistance('3.1', 'mi')).toBe(4989);
    expect(parseDistance('5.255', 'km')).toBeUndefined();
    expect(parseDistance('', 'km')).toBeNull();
    expect(distanceText(5200, 'km')).toBe('5.2');
    expect(distanceText(4989, 'mi')).toBe('3.1');
  });

  it('shows a pace only with a distance (spec §3.5)', () => {
    expect(paceSeconds(1920, 5200, 'km')).toBe(369);
    expect(paceSeconds(1920, 0, 'km')).toBeNull();
  });
});

describe('reading fields', () => {
  it('keep pages read and the current page in step (spec §3.6 example)', () => {
    expect(endPageFor(144, 24)).toBe(168);
    expect(pagesReadFor(144, 168)).toBe(24);
  });

  it('need a book, at least one new page and no page past the last', () => {
    const book = { id: 'b', total_pages: 320 };
    expect(problemsOf('reading', form({ endPageText: '168' }), 'km', { book, previousEnd: 144 }, NOW)).toEqual({});
    expect(problemsOf('reading', form({ endPageText: '144' }), 'km', { book, previousEnd: 144 }, NOW)).toEqual({ pages: 'pagesTooFew' });
    expect(problemsOf('reading', form({ endPageText: '321' }), 'km', { book, previousEnd: 144 }, NOW)).toEqual({ pages: 'pastLastPage' });
    expect(problemsOf('reading', form({ endPageText: '168' }), 'km', { book: undefined, previousEnd: 0 }, NOW)).toEqual({ book: 'noBook' });
    expect(problemsOf('reading', form({ endPageText: '168', minutesText: '0' }), 'km', { book, previousEnd: 144 }, NOW)).toEqual({ minutes: 'tooShort' });
  });
});

describe('what keeps a quick log from being saved', () => {
  it('checks the limits of spec §3.2', () => {
    expect(problemsOf('cardio', form({ durationText: '32:00', distanceText: '5.2' }), 'km', null, NOW)).toEqual({});
    expect(problemsOf('cardio', form(), 'km', null, NOW)).toEqual({ duration: 'required' });
    expect(problemsOf('cardio', form({ durationText: '25:00:00', distanceText: '1001' }), 'km', null, NOW)).toEqual({
      duration: 'tooLong',
      distance: 'tooFar',
    });
    expect(problemsOf('duration', form(), 'km', null, NOW)).toEqual({ minutes: 'required' });
    expect(problemsOf('duration', form({ minutesText: '1441' }), 'km', null, NOW)).toEqual({ minutes: 'tooLong' });
    expect(problemsOf('counter', form({ count: 1001 }), 'km', null, NOW)).toEqual({ count: 'invalid' });
  });

  it('refuses a moment in the future', () => {
    expect(problemsOf('counter', form({ time: '18:31' }), 'km', null, NOW)).toEqual({ when: 'inFuture' });
    expect(startedAt('2026-10-26', '18:30').getTime()).toBe(NOW.getTime());
  });
});

describe('the session sent', () => {
  it('has the part of its type, in canonical units', () => {
    const base = { tracker_id: 't', started_at: NOW.toISOString(), local_date: '2026-10-26', note: null };
    expect(toSession('cardio', 't', form({ durationText: '32:00', distanceText: '3.1' }), 'mi', undefined)).toEqual({
      ...base,
      duration_s: 1920,
      cardio: { distance_m: 4989 },
    });
    expect(toSession('cardio', 't', form({ durationText: '32', note: ' Easy pace. ' }), 'km', undefined)).toEqual({
      ...base,
      note: 'Easy pace.',
      duration_s: 1920,
      cardio: { distance_m: null },
    });
    expect(toSession('reading', 't', form({ endPageText: '168', minutesText: '20' }), 'km', 'b')).toEqual({
      ...base,
      duration_s: 1200,
      reading: { book_id: 'b', end_page: 168 },
    });
    expect(toSession('reading', 't', form({ endPageText: '168' }), 'km', 'b').duration_s).toBeNull();
    expect(toSession('duration', 't', form({ minutesText: '10' }), 'km', undefined)).toEqual({ ...base, duration_s: 600 });
    expect(toSession('counter', 't', form({ count: 6 }), 'km', undefined)).toEqual({ ...base, general: { count: 6 } });
    const exact = new Date(2026, 9, 26, 18, 30, 42, 500);
    expect(toSession('counter', 't', form({ count: 1 }), 'km', undefined, exact).started_at).toBe(exact.toISOString());
  });
});

describe('prefilled from the last session', () => {
  const stats = { volume_kg: null, working_sets: null, pages_read: 24, pace_s_per_km: null };

  it('repeats the last values, with the note empty', () => {
    const cardio = prefill('cardio', { duration_s: 1920, cardio: { distance_m: 5200 }, general: null, stats }, 'km', null, '2026-10-26', '18:30');
    expect(cardio).toMatchObject({ durationText: '32:00', distanceText: '5.2', note: '' });
    expect(prefill('counter', { duration_s: null, cardio: null, general: { count: 6 }, stats }, 'km', null, 'd', 't').count).toBe(6);
    expect(prefill('duration', { duration_s: 610, cardio: null, general: null, stats }, 'km', null, 'd', 't').minutesText).toBe('10');
    expect(prefill('counter', undefined, 'km', null, 'd', 't').count).toBe(1);
  });

  it('reads the same number of pages again, never past the last page', () => {
    const last = { duration_s: 1200, cardio: null, general: null, stats };
    expect(prefill('reading', last, 'km', { previousEnd: 144, totalPages: 320 }, 'd', 't')).toMatchObject({
      pagesReadText: '24',
      endPageText: '168',
      minutesText: '20',
    });
    expect(prefill('reading', last, 'km', { previousEnd: 310, totalPages: 320 }, 'd', 't')).toMatchObject({ pagesReadText: '10', endPageText: '320' });
    expect(prefill('reading', undefined, 'km', { previousEnd: 0, totalPages: 320 }, 'd', 't')).toMatchObject({ pagesReadText: '', endPageText: '' });
  });
});

describe('beside the form', () => {
  it('shows the tracker’s amount goal, today’s first, else its frequency goal', () => {
    const weekly = goal({ id: 'weekly' });
    const distance = goal({ id: 'distance', kind: 'amount', period: 'week' });
    const daily = goal({ id: 'daily', kind: 'amount', period: 'day' });
    const total = goal({ id: 'total', kind: 'cumulative', period: null });
    expect(sideGoal([weekly, distance, daily, total], 'run')?.id).toBe('daily');
    expect(sideGoal([weekly, distance], 'run')?.id).toBe('distance');
    expect(sideGoal([weekly, total], 'run')?.id).toBe('weekly');
    expect(sideGoal([total, goal({ tracker_id: 'other' })], 'run')).toBeUndefined();
  });

  it('offers only books still being read', () => {
    const book = (id: string, current: number, finished: string | null) =>
      ({ id, current_page: current, total_pages: 320, finished_date: finished }) as never;
    expect(openBooks([book('a', 100, null), book('b', 320, '2026-10-01'), book('c', 0, null)]).map((item: { id: string }) => item.id)).toEqual(['a', 'c']);
  });
});
