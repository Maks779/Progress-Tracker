import type { SessionOut } from '@/shared/api/generated/model';

import {
  clock,
  cleanRepsText,
  cleanWeightText,
  type DraftExercise,
  type DraftSet,
  durationSeconds,
  effective,
  endsRound,
  extendRest,
  groupWithNext,
  leaveGroup,
  newExercise,
  newSet,
  nextInSuperset,
  normalizeGroups,
  parseWeight,
  restLeft,
  roundOrder,
  setNumber,
  setProblems,
  tally,
  toggleSet,
  toSession,
  weightIn,
  withNote,
  type WorkoutDraft,
} from '../rules';

const INFO = { key: 'bench_press', name: 'Bench press', is_custom: false };

function set(overrides: Partial<DraftSet> = {}): DraftSet {
  return { id: 's', kind: 'working', weightKg: null, reps: null, ghost: null, done: false, ...overrides };
}

function exercise(id: string, sets: DraftSet[], overrides: Partial<DraftExercise> = {}): DraftExercise {
  return { id, exerciseId: `${id}-ex`, info: INFO, group: null, weighted: true, previous: [], sets, ...overrides };
}

function draft(exercises: DraftExercise[], overrides: Partial<WorkoutDraft> = {}): WorkoutDraft {
  return {
    version: 1,
    id: 'session',
    userId: 'me',
    trackerId: 'gym',
    name: 'Upper body A',
    startedAt: '2026-11-26T17:00:00.000Z',
    localDate: '2026-11-26',
    exercises,
    rest: null,
    ...overrides,
  };
}

const done = (weightKg: number | null, reps: number, kind: DraftSet['kind'] = 'working') =>
  set({ id: `${weightKg}x${reps}`, weightKg, reps, kind, done: true });

describe('a set', () => {
  it('saves what was typed, else the ghost values of last time', () => {
    expect(effective(set({ ghost: { weightKg: 60, reps: 8 } }))).toEqual({ weightKg: 60, reps: 8 });
    expect(effective(set({ weightKg: 62.5, ghost: { weightKg: 60, reps: 8 } }))).toEqual({ weightKg: 62.5, reps: 8 });
    expect(effective(set({ weightKg: 0, reps: 12 }))).toEqual({ weightKg: null, reps: 12 });
  });

  it('needs reps, and a weight unless the exercise is bodyweight', () => {
    expect(setProblems(set(), true)).toEqual(['weightRequired', 'repsRequired']);
    expect(setProblems(set({ reps: 12 }), false)).toEqual([]);
    expect(setProblems(set({ weightKg: 1000.5, reps: 101 }), true)).toEqual(['weightRange', 'repsRange']);
    expect(setProblems(set({ ghost: { weightKg: 60, reps: 8 } }), true)).toEqual([]);
  });

  it('numbers working sets only; warm-ups have none', () => {
    const sets = [set({ kind: 'warmup' }), set(), set({ kind: 'warmup' }), set()];
    expect(sets.map((_, index) => setNumber(sets, index))).toEqual([null, 1, null, 2]);
  });
});

describe('new rows', () => {
  const previous = [
    { weightKg: 40, reps: 10, kind: 'warmup' as const },
    { weightKg: 60, reps: 8, kind: 'working' as const },
  ];

  it('get one row per set of last time, with its kind and values as ghosts', () => {
    const made = newExercise({ entry: 'e', sets: ['a', 'b'] }, 'bench', INFO, true, previous);
    expect(made.sets.map((row) => [row.id, row.kind, row.ghost])).toEqual([
      ['a', 'warmup', { weightKg: 40, reps: 10 }],
      ['b', 'working', { weightKg: 60, reps: 8 }],
    ]);
  });

  it('start with one empty row without history', () => {
    const made = newExercise({ entry: 'e', sets: ['a'] }, 'bench', INFO, true, []);
    expect(made.sets).toEqual([set({ id: 'a' })]);
  });

  it('beyond last time copy the set above, typed values first', () => {
    const made = newExercise({ entry: 'e', sets: ['a', 'b'] }, 'bench', INFO, true, previous);
    made.sets[1] = { ...made.sets[1], weightKg: 65 };
    expect(newSet('c', made)).toEqual(set({ id: 'c', ghost: { weightKg: 65, reps: 8 } }));
    expect(newSet('d', { ...made, sets: [], previous: [] }).ghost).toBeNull();
  });
});

describe('supersets', () => {
  const four = () => ['a', 'b', 'c', 'd'].map((id) => exercise(id, [set({ id: `${id}1` })]));
  const groups = (list: DraftExercise[]) => list.map((item) => item.group);

  it('group an exercise with the next one, and grow', () => {
    let list = groupWithNext(four(), 0);
    expect(groups(list)).toEqual([1, 1, null, null]);
    list = groupWithNext(list, 1);
    expect(groups(list)).toEqual([1, 1, 1, null]);
    list = groupWithNext(list, 3 - 1);
    expect(groups(list)).toEqual([1, 1, 1, 1]);
  });

  it('take the next superset in whole when joining it', () => {
    const list = groupWithNext(groupWithNext(four(), 2), 1);
    expect(groups(list)).toEqual([null, 1, 1, 1]);
  });

  it('split around an exercise that leaves, and never keep a superset of one', () => {
    const all = normalizeGroups(four().map((item) => ({ ...item, group: 7 })));
    expect(groups(leaveGroup(all, 1))).toEqual([null, null, 1, 1]);
    expect(groups(leaveGroup(all, 3))).toEqual([1, 1, 1, null]);
    const two = normalizeGroups([exercise('a', [], { group: 3 }), exercise('b', [], { group: 3 })]);
    expect(groups(leaveGroup(two, 0))).toEqual([null, null]);
  });

  it('renumber in order and keep removed neighbours together', () => {
    const list = [
      exercise('a', [], { group: 5 }),
      exercise('b', [], { group: 5 }),
      exercise('c', [], { group: 2 }),
      exercise('d', [], { group: 2 }),
    ];
    expect(groups(normalizeGroups(list))).toEqual([1, 1, 2, 2]);
    const withMiddle = [exercise('a', [], { group: 4 }), exercise('b', [], { group: 4 }), exercise('c', [], { group: 4 })];
    expect(groups(normalizeGroups([withMiddle[0], withMiddle[2]]))).toEqual([1, 1]);
  });

  const superset = () =>
    normalizeGroups([
      exercise('a', [set({ id: 'a1', reps: 10 }), set({ id: 'a2', reps: 10 }), set({ id: 'a3', reps: 10 })], { group: 1 }),
      exercise('b', [set({ id: 'b1', reps: 12 }), set({ id: 'b2', reps: 12 })], { group: 1 }),
      exercise('c', [set({ id: 'c1', reps: 5 })]),
    ]);

  it('go in rounds: A1, B1, A2, B2, then A3 alone', () => {
    const list = superset();
    expect(roundOrder(list, [0, 1]).map(({ exercise: e, set: s }) => list[e].sets[s].id)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3']);
  });

  it('highlight the next set in round order, outside supersets nothing', () => {
    const list = superset();
    expect(nextInSuperset(list, 0)).toBe('a1');
    list[0].sets[0].done = true;
    expect(nextInSuperset(list, 1)).toBe('b1');
    list[1].sets[0].done = true;
    list[0].sets[1].done = true;
    expect(nextInSuperset(list, 0)).toBe('b2');
    expect(nextInSuperset(list, 2)).toBeNull();
  });

  it('rest only after the set that ends a round', () => {
    const list = superset();
    expect(endsRound(list, 0, 0)).toBe(false);
    expect(endsRound(list, 1, 0)).toBe(true);
    expect(endsRound(list, 0, 2)).toBe(true);
    expect(endsRound(list, 2, 0)).toBe(true);
  });
});

describe('checking a set', () => {
  const NOW = Date.parse('2026-11-26T17:20:00Z');

  it('keeps the values it was checked with and starts a 90 s rest', () => {
    const workout = draft([exercise('a', [set({ ghost: { weightKg: 60, reps: 8 } })])]);
    const checked = toggleSet(workout, 0, 0, NOW);
    expect(checked.exercises[0].sets[0]).toEqual(set({ weightKg: 60, reps: 8, ghost: { weightKg: 60, reps: 8 }, done: true }));
    expect(checked.rest).toEqual({ endsAt: NOW + 90_000, seconds: 90 });
  });

  it('starts no rest inside a superset round, and unchecking keeps the rest', () => {
    const workout = draft(
      normalizeGroups([exercise('a', [set({ weightKg: 10, reps: 10 })], { group: 1 }), exercise('b', [set({ weightKg: 20, reps: 12 })], { group: 1 })]),
    );
    const first = toggleSet(workout, 0, 0, NOW);
    expect(first.exercises[0].sets[0].done).toBe(true);
    expect(first.rest).toBeNull();
    const round = toggleSet(first, 1, 0, NOW);
    expect(round.rest?.seconds).toBe(90);
    const unchecked = toggleSet(round, 1, 0, NOW + 1000);
    expect(unchecked.exercises[1].sets[0].done).toBe(false);
    expect(unchecked.rest).toEqual(round.rest);
  });

  it('leaves a set that cannot be checked yet as it was', () => {
    const workout = draft([exercise('a', [set({ reps: 8 })])]);
    expect(toggleSet(workout, 0, 0, NOW)).toBe(workout);
  });

  it('adds 30 s to the rest left, or from now once it ran out', () => {
    const rest = { endsAt: NOW + 40_000, seconds: 90 };
    expect(extendRest(rest, NOW)).toEqual({ endsAt: NOW + 70_000, seconds: 120 });
    expect(extendRest(rest, NOW + 60_000)).toEqual({ endsAt: NOW + 90_000, seconds: 120 });
    expect(restLeft(rest, NOW)).toBe(40);
    expect(restLeft(rest, NOW + 41_000)).toBe(0);
    expect(restLeft(null, NOW)).toBe(0);
  });
});

describe('the workout so far', () => {
  it('counts checked and open sets and the volume of checked working sets (spec §3.3 example)', () => {
    const bench = exercise('bench', [done(40, 10, 'warmup'), done(62.5, 8), done(60, 8), done(60, 10), set()]);
    const pullUps = exercise('pull', [done(null, 12)], { weighted: false });
    expect(tally([bench, pullUps])).toEqual({ done: 5, open: 1, workingDone: 4, volumeKg: 1580 });
  });

  it('lasts from the start to now, at least a second and at most 24 hours', () => {
    expect(durationSeconds('2026-11-26T17:00:00Z', Date.parse('2026-11-26T17:18:42Z'))).toBe(1122);
    expect(durationSeconds('2026-11-26T17:00:00Z', Date.parse('2026-11-26T16:59:00Z'))).toBe(1);
    expect(durationSeconds('2026-11-24T17:00:00Z', Date.parse('2026-11-26T17:00:00Z'))).toBe(86_400);
  });
});

describe('finishing', () => {
  const NOW = Date.parse('2026-11-26T17:48:12Z');

  it('sends only checked sets, renumbered, and drops exercises without any', () => {
    const workout = draft(
      normalizeGroups([
        exercise('a', [set({ id: 'x', reps: 8 }), done(61.234_967_1, 8)], { group: 1 }),
        exercise('b', [set()], { group: 1 }),
        exercise('c', [done(null, 12, 'warmup'), done(20, 10)], { group: 1 }),
        exercise('d', [done(100, 5)]),
      ]),
      { name: '  Upper body A  ' },
    );
    expect(toSession(workout, NOW)).toEqual({
      tracker_id: 'gym',
      started_at: '2026-11-26T17:00:00.000Z',
      local_date: '2026-11-26',
      duration_s: 2892,
      name: 'Upper body A',
      strength: {
        exercises: [
          { id: 'a', exercise_id: 'a-ex', position: 0, superset_group: 1, sets: [{ position: 0, weight_kg: 61.235, reps: 8, kind: 'working' }] },
          {
            id: 'c',
            exercise_id: 'c-ex',
            position: 1,
            superset_group: 1,
            sets: [
              { position: 0, weight_kg: null, reps: 12, kind: 'warmup' },
              { position: 1, weight_kg: 20, reps: 10, kind: 'working' },
            ],
          },
          { id: 'd', exercise_id: 'd-ex', position: 2, superset_group: null, sets: [{ position: 0, weight_kg: 100, reps: 5, kind: 'working' }] },
        ],
      },
    });
  });

  it('ungroups a superset left with one exercise and has nothing to send without a checked set', () => {
    const workout = draft(normalizeGroups([exercise('a', [done(60, 8)], { group: 1 }), exercise('b', [set()], { group: 1 })]));
    expect(toSession(workout, NOW)?.strength?.exercises[0].superset_group).toBeNull();
    expect(toSession(draft([exercise('a', [set({ reps: 8 })])]), NOW)).toBeUndefined();
  });

  it('sends a saved session back whole with its new note', () => {
    const session = {
      id: 'saved',
      tracker_id: 'gym',
      started_at: '2026-11-26T17:00:00Z',
      local_date: '2026-11-26',
      duration_s: 2892,
      name: 'Upper body A',
      note: null,
      strength: {
        exercises: [{ id: 'a', exercise_id: 'bench', position: 0, superset_group: null, sets: [{ position: 0, weight_kg: 60, reps: 8, kind: 'working' }] }],
      },
    } as unknown as SessionOut;
    expect(withNote(session, '  Felt strong.  ')).toEqual({
      tracker_id: 'gym',
      started_at: '2026-11-26T17:00:00Z',
      local_date: '2026-11-26',
      duration_s: 2892,
      name: 'Upper body A',
      note: 'Felt strong.',
      strength: session.strength,
    });
    expect(withNote(session, '   ').note).toBeNull();
  });
});

describe('numbers in fields', () => {
  it('read kg and lb with a dot or a comma, stored in kg to 4 decimals', () => {
    expect(parseWeight('62,5', 'kg')).toBe(62.5);
    expect(parseWeight('135', 'lb')).toBe(61.235);
    expect(parseWeight(' ', 'kg')).toBeNull();
    expect(parseWeight('.', 'kg')).toBeUndefined();
  });

  it('show a stored weight in the person’s unit, so 135 lb comes back as 135', () => {
    expect(weightIn(61.235, 'lb')).toBe(135);
    expect(weightIn(62.25, 'kg')).toBe(62.25);
    expect(weightIn(60, 'lb')).toBe(132.28);
  });

  it('keep only digits and one separator with two decimals, reps up to three digits', () => {
    expect(cleanWeightText('62.555')).toBe('62.55');
    expect(cleanWeightText('a1,2.3')).toBe('1,23');
    expect(cleanWeightText('12345')).toBe('1234');
    expect(cleanRepsText('1a2-34')).toBe('123');
  });

  it('show time as a stopwatch', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(1122)).toBe('18:42');
    expect(clock(3723)).toBe('1:02:03');
  });
});
