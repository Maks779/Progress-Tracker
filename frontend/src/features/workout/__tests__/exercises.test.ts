import type { ExerciseOut } from '@/shared/api/generated/model';
import i18n from '@/shared/i18n';

import { exerciseName, filterExercises, isWeighted, searchable } from '../exercises';

function exercise(id: string, key: string | null, overrides: Partial<ExerciseOut> = {}): ExerciseOut {
  return {
    id,
    key,
    name: null,
    is_custom: false,
    muscle_group: 'chest',
    equipment: 'barbell',
    mechanic: 'compound',
    last_used_date: null,
    ...overrides,
  } as ExerciseOut;
}

const ITEMS = [
  exercise('ohp', 'overhead_press', { muscle_group: 'shoulders', last_used_date: '2026-11-10' }),
  exercise('bench', 'bench_press', { last_used_date: '2026-11-24' }),
  exercise('incline', 'incline_bench_press'),
  exercise('mine', null, { name: 'Spider curl', is_custom: true, muscle_group: 'arms', equipment: 'dumbbell' }),
];

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('exercise names', () => {
  it('come from the UI language for the catalog and stay as typed for custom ones', async () => {
    await i18n.changeLanguage('uk');
    expect(exerciseName(ITEMS[1], i18n.t)).toBe('Жим штанги лежачи');
    expect(exerciseName(ITEMS[3], i18n.t)).toBe('Spider curl');
    expect(exerciseName(undefined, i18n.t)).toBe('Вправа');
    await i18n.changeLanguage('en');
    expect(exerciseName(ITEMS[1], i18n.t)).toBe('Bench press');
  });

  it('need a weight unless the exercise is bodyweight', () => {
    expect(isWeighted({ equipment: 'bodyweight' })).toBe(false);
    expect(isWeighted({ equipment: 'dumbbell' })).toBe(true);
  });
});

describe('the picker’s search', () => {
  it('ignores case and accents, Polish ł included', () => {
    expect(searchable('  Wyciskanie ŻOŁNIERSKIE ')).toBe('wyciskanie zolnierskie');
    expect(searchable('Жим')).toBe('жим');
  });

  it('matches every typed word, in any order, and puts the exercises used lately first', async () => {
    await i18n.changeLanguage('pl');
    const nameOf = (item: ExerciseOut) => exerciseName(item, i18n.t);
    expect(filterExercises(ITEMS, 'zolnierskie', 'all', nameOf, 'pl').map((item) => item.id)).toEqual(['ohp']);
    expect(filterExercises(ITEMS, 'ławce wyciskanie', 'all', nameOf, 'pl').map((item) => item.id)).toEqual(['bench', 'incline']);
    expect(filterExercises(ITEMS, '', 'chest', nameOf, 'pl').map((item) => item.id)).toEqual(['bench', 'incline']);
    expect(filterExercises(ITEMS, 'spider', 'arms', nameOf, 'pl').map((item) => item.id)).toEqual(['mine']);
    expect(filterExercises(ITEMS, '', 'all', nameOf, 'pl').map((item) => item.id)).toEqual(['bench', 'ohp', 'mine', 'incline']);
  });
});
