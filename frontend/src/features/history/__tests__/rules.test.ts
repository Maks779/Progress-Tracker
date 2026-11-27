import type { ExerciseOut, SessionOut, StrengthEntryOut, StrengthSetOut, TrackerSummary } from '@/shared/api/generated/model';

import {
  draftFromSession,
  editedStrength,
  entryCards,
  filterGroups,
  inWeek,
  monthGrid,
  sameSets,
  sessionTitle,
  setsVolume,
  shiftMonth,
  strengthProblems,
  weekKind,
  weekOf,
  workingSetCount,
} from '../rules';

const set = (position: number, weight: number | null, reps: number, kind: 'working' | 'warmup' = 'working'): StrengthSetOut => ({
  position,
  weight_kg: weight,
  reps,
  kind,
});

const entry = (id: string, position: number, sets: StrengthSetOut[], group: number | null = null): StrengthEntryOut => ({
  id,
  exercise_id: `exercise-${id}`,
  position,
  superset_group: group,
  sets,
});

function tracker(id: string, position: number, archived = false): TrackerSummary {
  return { id, name: id, position, archived } as TrackerSummary;
}

describe('the month and the week', () => {
  it('lays a month out in weeks from Monday, with blanks around it', () => {
    const november = monthGrid('2026-11');
    expect(november[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(november).toHaveLength(6);
    expect(november[5][0]).toBe('2026-11-30');
    expect(november[5].slice(1)).toEqual([null, null, null, null, null, null]);
    expect(monthGrid('2027-02').flat().filter(Boolean)).toHaveLength(28);
  });

  it('moves between months across years', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-03', -14)).toBe('2025-01');
  });

  it('takes ISO weeks, Monday to Sunday (design §7.2)', () => {
    expect(weekOf('2026-11-27')).toEqual({ from: '2026-11-23', to: '2026-11-29' });
    expect(weekOf('2026-11-29')).toEqual({ from: '2026-11-23', to: '2026-11-29' });
    expect(weekOf('2026-11-23')).toEqual({ from: '2026-11-23', to: '2026-11-29' });
    expect(weekOf('2026-12-31')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
    expect(weekKind(weekOf('2026-11-24'), '2026-11-27')).toBe('this');
    expect(weekKind(weekOf('2026-11-16'), '2026-11-27')).toBe('last');
    expect(weekKind(weekOf('2026-11-09'), '2026-11-27')).toBe('other');
    expect(inWeek('2026-11-29', weekOf('2026-11-27'))).toBe(true);
    expect(inWeek('2026-11-30', weekOf('2026-11-27'))).toBe(false);
  });
});

describe('the tracker filter', () => {
  it('shows every tracker that fits in three segments, else two and More, archived ones last', () => {
    expect(filterGroups([tracker('gym', 0), tracker('read', 1)]).rest).toEqual([]);
    expect(filterGroups([tracker('gym', 0), tracker('read', 1), tracker('run', 2)]).shown.map((item) => item.id)).toEqual(['gym', 'read', 'run']);
    const groups = filterGroups([tracker('swim', 0, true), tracker('run', 2), tracker('gym', 0), tracker('read', 1)]);
    expect(groups.shown.map((item) => item.id)).toEqual(['gym', 'read']);
    expect(groups.rest.map((item) => item.id)).toEqual(['run', 'swim']);
  });
});

describe('a saved session', () => {
  it('is called by its name, its book or its tracker', () => {
    expect(sessionTitle({ name: 'Upper body A', reading: null }, { name: 'Gym' }, undefined)).toBe('Upper body A');
    expect(sessionTitle({ name: null, reading: { book_id: 'b', end_page: 10 } }, { name: 'Reading' }, 'Atomic Habits')).toBe('Atomic Habits');
    expect(sessionTitle({ name: null, reading: null }, { name: 'Running' }, 'Atomic Habits')).toBe('Running');
  });

  it('groups a superset into one card, in order', () => {
    const cards = entryCards([entry('c', 2, [], 1), entry('a', 0, []), entry('d', 3, [], 1), entry('b', 1, [], 2)]);
    expect(cards.map((card) => card.map((item) => item.id))).toEqual([['a'], ['b'], ['c', 'd']]);
  });

  it('counts volume and sets of working sets only (spec §3.3)', () => {
    const sets = [set(0, 40, 10, 'warmup'), set(1, 62.5, 8), set(2, 60, 8), set(3, null, 12)];
    expect(setsVolume(sets)).toBe(980);
    expect(workingSetCount(sets)).toBe(3);
  });

  it('reads equal working sets as one line', () => {
    expect(sameSets([set(0, 50, 10), set(1, 50, 10), set(2, 50, 10)])).toEqual({ count: 3, reps: 10, weightKg: 50 });
    expect(sameSets([set(0, null, 12), set(1, null, 12)])).toEqual({ count: 2, reps: 12, weightKg: null });
    expect(sameSets([set(0, 50, 10), set(1, 50, 8)])).toBeNull();
    expect(sameSets([set(0, 40, 10, 'warmup'), set(1, 40, 10)])).toBeNull();
    expect(sameSets([set(0, 50, 10)])).toBeNull();
  });
});

describe('editing a workout', () => {
  const session = {
    id: 's1',
    tracker_id: 'gym',
    tracker_type: 'strength',
    name: 'Upper body A',
    note: 'Felt strong.',
    started_at: '2026-11-27T11:00:00Z',
    local_date: '2026-11-27',
    duration_s: 2892,
    strength: {
      exercises: [
        entry('bench', 0, [set(1, 60, 8), set(0, 40, 10, 'warmup')]),
        entry('pullup', 1, [set(0, null, 10), set(1, 10, 8)], 1),
        entry('row', 2, [set(0, 50, 10)], 1),
      ],
    },
  } as SessionOut;
  const catalog = new Map<string, ExerciseOut>([
    ['exercise-bench', { id: 'exercise-bench', key: 'bench_press', name: null, is_custom: false, equipment: 'barbell' } as ExerciseOut],
    ['exercise-pullup', { id: 'exercise-pullup', key: 'pull_up', name: null, is_custom: false, equipment: 'barbell' } as ExerciseOut],
    ['exercise-row', { id: 'exercise-row', key: 'barbell_row', name: null, is_custom: false, equipment: 'barbell' } as ExerciseOut],
  ]);
  let next = 0;
  const newId = () => `set-${(next += 1)}`;

  it('opens every set in the editor, in order; a set without weight never blocks', () => {
    const draft = draftFromSession(session, 'me', catalog, newId);
    expect(draft).toMatchObject({ id: 's1', userId: 'me', trackerId: 'gym', name: 'Upper body A', rest: null });
    expect(draft.exercises.map((exercise) => [exercise.id, exercise.group, exercise.weighted])).toEqual([
      ['bench', null, true],
      ['pullup', 1, false],
      ['row', 1, true],
    ]);
    expect(draft.exercises[0].sets.map((item) => [item.kind, item.weightKg, item.reps, item.done])).toEqual([
      ['warmup', 40, 10, false],
      ['working', 60, 8, false],
    ]);
    expect(strengthProblems(draft, '48')).toEqual([]);
  });

  it('refuses no sets, a set without its values and a duration out of range', () => {
    const draft = draftFromSession(session, 'me', catalog, newId);
    const empty = { ...draft, exercises: draft.exercises.map((exercise) => ({ ...exercise, sets: [] })) };
    expect(strengthProblems(empty, '48')).toEqual(['empty']);
    const missing = { ...draft, exercises: [{ ...draft.exercises[0], sets: [{ ...draft.exercises[0].sets[1], reps: null }] }] };
    expect(strengthProblems(missing, '0')).toEqual(['sets', 'duration']);
    expect(strengthProblems(draft, '1441')).toEqual(['duration']);
  });

  it('saves every set, drops emptied exercises and renumbers supersets', () => {
    const draft = draftFromSession(session, 'me', catalog, newId);
    const edited = {
      ...draft,
      name: '  ',
      exercises: [
        draft.exercises[0],
        { ...draft.exercises[1], sets: [] },
        { ...draft.exercises[2], sets: [...draft.exercises[2].sets, { ...draft.exercises[2].sets[0], id: 'new', weightKg: null, reps: null, ghost: { weightKg: 52.5, reps: 9 } }] },
      ],
    };
    const body = editedStrength(edited, '50', ' Good. ', { startedAt: session.started_at, localDate: session.local_date });
    expect(body).toMatchObject({ tracker_id: 'gym', name: null, note: 'Good.', duration_s: 3000, started_at: '2026-11-27T11:00:00Z' });
    expect(body.strength?.exercises).toEqual([
      {
        id: 'bench',
        exercise_id: 'exercise-bench',
        position: 0,
        superset_group: null,
        sets: [
          { position: 0, weight_kg: 40, reps: 10, kind: 'warmup' },
          { position: 1, weight_kg: 60, reps: 8, kind: 'working' },
        ],
      },
      {
        id: 'row',
        exercise_id: 'exercise-row',
        position: 1,
        superset_group: null,
        sets: [
          { position: 0, weight_kg: 50, reps: 10, kind: 'working' },
          { position: 1, weight_kg: 52.5, reps: 9, kind: 'working' },
        ],
      },
    ]);
  });
});
