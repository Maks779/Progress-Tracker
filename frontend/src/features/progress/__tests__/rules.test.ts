import type { ExerciseOut, RecordOut } from '@/shared/api/generated/model';

import {
  axisTicks,
  compactNumber,
  consistencyGrid,
  doneExercises,
  estimatedMax,
  labelIndexes,
  linePositions,
  newRecords,
  periodStart,
} from '../rules';

const record = (record_type: RecordOut['record_type'], value: number, weight_kg: number | null, reps: number): RecordOut =>
  ({ exercise_id: 'bench', record_type, value, weight_kg, reps, session_id: 's', local_date: '2026-10-20' }) as RecordOut;

describe('the chart scales', () => {
  it('picks three round values around the data, as in the design', () => {
    expect(axisTicks([45, 47.5, 50, 55, 57.5, 62.5])).toEqual([45, 55, 65]);
    expect(axisTicks([6000, 8000, 7000, 10_300])).toEqual([5000, 10_000, 15_000]);
    expect(axisTicks([100, 102.5])).toEqual([90, 100, 110]);
    expect(axisTicks([87.5, 87.5, 87.5])).toEqual([82.5, 87.5, 92.5]);
    expect(axisTicks([60])).toEqual([55, 60, 65]);
    expect(axisTicks([24, 60, 36])).toEqual([20, 40, 60]);
  });

  it('spreads the points across the box and dates a few of them', () => {
    expect(linePositions([45, 55, 65], 200, 100, [45, 55, 65])).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 50 },
      { x: 200, y: 0 },
    ]);
    expect(linePositions([50], 200, 100, [45, 55, 65])).toEqual([{ x: 100, y: 75 }]);
    expect(labelIndexes(3)).toEqual([0, 1, 2]);
    expect(labelIndexes(10)).toEqual([0, 3, 6, 9]);
  });

  it('writes big numbers short, without wrapping', () => {
    expect(compactNumber(940, 'en')).toBe('940');
    expect(compactNumber(6000, 'en')).toBe('6.0k');
    expect(compactNumber(10_300, 'en')).toBe('10.3k');
    expect(compactNumber(10_300, 'pl')).toBe('10,3k');
  });
});

describe('the period and the consistency grid', () => {
  it('starts 4W, 3M and 1Y on a Monday so they end with this week, and All at the first session', () => {
    expect(periodStart('4w', '2026-11-27', undefined)).toBe('2026-11-02');
    expect(periodStart('3m', '2026-11-27', undefined)).toBe('2026-08-31');
    expect(periodStart('1y', '2026-11-27', undefined)).toBe('2025-12-01');
    expect(periodStart('all', '2026-11-27', '2025-03-14')).toBe('2025-03-14');
    expect(periodStart('all', '2026-11-27', undefined)).toBe('2026-11-27');
  });

  it('lays the days out a week per column, Monday first, empty outside the period', () => {
    const grid = consistencyGrid(['2026-11-03', '2026-11-27'], '2026-11-02', '2026-11-27');
    expect(grid).toHaveLength(4);
    expect(grid[0][0]).toEqual({ date: '2026-11-02', active: false });
    expect(grid[0][1]).toEqual({ date: '2026-11-03', active: true });
    expect(grid[3][4]).toEqual({ date: '2026-11-27', active: true });
    expect(grid[3][5]).toBeNull();
    expect(consistencyGrid([], '2024-01-03', '2026-11-27')).toHaveLength(53);
  });
});

describe('the exercises the line can show', () => {
  it('are the ones done, most recent first', () => {
    const exercise = (id: string, last: string | null) => ({ id, last_used_date: last }) as ExerciseOut;
    expect(doneExercises([exercise('a', null), exercise('b', '2026-11-01'), exercise('c', '2026-11-20')]).map((item) => item.id)).toEqual(['c', 'b']);
  });
});

describe('records against the current bests (spec §3.4)', () => {
  const bests = {
    max_weight: record('max_weight', 60, 60, 8),
    max_reps: record('max_reps', 8, 60, 8),
    estimated_1rm: record('estimated_1rm', 76, 60, 8),
  };

  it('follows the spec’s example: three new records', () => {
    expect(estimatedMax(60, 8)).toBeCloseTo(76, 6);
    expect(estimatedMax(100, 1)).toBe(100);
    expect(estimatedMax(60, 12)).toBeNull();
    const found = newRecords(bests, [
      { weightKg: 62.5, reps: 8 },
      { weightKg: 60, reps: 10 },
    ]);
    expect(found.map((item) => [item.recordType, Math.round(item.value * 10) / 10])).toEqual([
      ['max_weight', 62.5],
      ['max_reps', 10],
      ['estimated_1rm', 80],
    ]);
  });

  it('never counts a tie, and the first time is the baseline', () => {
    expect(newRecords(bests, [{ weightKg: 60, reps: 8 }])).toEqual([]);
    expect(newRecords({ max_weight: null, max_reps: null, estimated_1rm: null }, [{ weightKg: 100, reps: 5 }])).toEqual([]);
    expect(newRecords(undefined, [{ weightKg: 100, reps: 5 }])).toEqual([]);
  });

  it('counts more reps at the same weight, and a heavier set at equal reps', () => {
    expect(newRecords(bests, [{ weightKg: 60, reps: 9 }]).map((item) => item.recordType)).toEqual(['max_reps', 'estimated_1rm']);
    expect(newRecords(bests, [{ weightKg: 61, reps: 8 }]).map((item) => item.recordType)).toEqual(['max_weight', 'max_reps', 'estimated_1rm']);
  });

  it('gives a bodyweight exercise max reps only', () => {
    const bodyweight = { max_weight: null, max_reps: record('max_reps', 10, null, 10), estimated_1rm: null };
    expect(newRecords(bodyweight, [{ weightKg: null, reps: 12 }])).toEqual([{ recordType: 'max_reps', value: 12, weightKg: null, reps: 12 }]);
    expect(newRecords(bodyweight, [{ weightKg: null, reps: 10 }])).toEqual([]);
  });
});
