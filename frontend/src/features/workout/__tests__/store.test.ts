import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

import { getSession } from '@/shared/api/generated/endpoints/sessions/sessions';
import { lastSets, listExercises } from '@/shared/api/generated/endpoints/exercises/exercises';
import type { SessionSaved } from '@/shared/api/generated/model';

import { MAX_EXERCISES, MAX_SETS, type WorkoutDraft } from '../rules';
import { prepareWorkout } from '../start';
import { hydrateWorkout, useWorkout, workout } from '../store';

jest.mock('@/shared/api/generated/endpoints/sessions/sessions', () => ({ getSession: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/exercises/exercises', () => ({
  lastSets: jest.fn(),
  listExercises: jest.fn(),
  getListExercisesQueryKey: () => ['/api/v1/exercises'],
}));

const NOW = Date.parse('2026-11-26T17:20:00Z');
const INFO = { key: 'bench_press', name: 'Bench press', is_custom: false };

function draft(): WorkoutDraft {
  return {
    version: 1,
    id: 'session',
    userId: 'me',
    trackerId: 'gym',
    name: 'Upper body A',
    startedAt: '2026-11-26T17:00:00.000Z',
    localDate: '2026-11-26',
    exercises: [],
    rest: null,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useWorkout.setState({ hydrated: false, draft: null, summary: null });
});

describe('the workout on the device', () => {
  it('is saved after every change and comes back after a restart', async () => {
    await hydrateWorkout();
    workout.begin(draft());
    workout.addExercises([{ exerciseId: 'bench', info: INFO, weighted: true, previous: [{ weightKg: 60, reps: 8, kind: 'working' }] }]);
    workout.toggleSet(0, 0, NOW);
    workout.rename('Push day');
    await settle();
    const saved = useWorkout.getState().draft;

    useWorkout.setState({ hydrated: false, draft: null, summary: null });
    await hydrateWorkout();
    expect(useWorkout.getState().draft).toEqual(saved);
    expect(saved?.name).toBe('Push day');
    expect(saved?.exercises[0].sets[0]).toMatchObject({ weightKg: 60, reps: 8, done: true });
    expect(saved?.rest).toEqual({ endsAt: NOW + 90_000, seconds: 90 });
  });

  it('drops what it cannot read', async () => {
    await AsyncStorage.setItem('ember.workout', JSON.stringify({ draft: { version: 2, id: 'x' }, summary: 'nope' }));
    await hydrateWorkout();
    expect(useWorkout.getState()).toMatchObject({ hydrated: true, draft: null, summary: null });
  });

  it('holds at most 30 exercises and 50 sets each', async () => {
    await hydrateWorkout();
    workout.begin(draft());
    const item = { exerciseId: 'bench', info: INFO, weighted: true, previous: [] };
    workout.addExercises(Array.from({ length: MAX_EXERCISES + 2 }, () => item));
    expect(useWorkout.getState().draft?.exercises).toHaveLength(MAX_EXERCISES);
    for (let index = 0; index < MAX_SETS + 5; index += 1) {
      workout.addSet(0);
    }
    expect(useWorkout.getState().draft?.exercises[0].sets).toHaveLength(MAX_SETS);
  });

  it('keeps the summary after Finish until Done, and log out leaves nothing behind', async () => {
    await hydrateWorkout();
    workout.begin(draft());
    const saved = { session: { id: 'session' }, new_records: [], goals: [] } as unknown as SessionSaved;
    workout.finished({ userId: 'me', trackerName: 'Gym', saved });
    await settle();
    expect(useWorkout.getState()).toMatchObject({ draft: null, summary: { trackerName: 'Gym' } });

    useWorkout.setState({ hydrated: false, draft: null, summary: null });
    await hydrateWorkout();
    expect(useWorkout.getState().summary?.saved.session.id).toBe('session');

    workout.clear();
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem('ember.workout')) ?? '{}')).toEqual({ draft: null, summary: null });
  });
});

describe('starting a workout', () => {
  let client: QueryClient;
  const upNext = { session_id: 'last', name: 'Upper body A', exercise_count: 3, estimated_duration_s: 2880 };
  const catalog = {
    status: 200,
    data: {
      items: [
        { id: 'bench', key: 'bench_press', name: 'Bench press', is_custom: false, equipment: 'barbell' },
        { id: 'pull', key: 'pull_up', name: 'Pull-up', is_custom: false, equipment: 'bodyweight' },
        { id: 'curl', key: null, name: 'Spider curl', is_custom: true, equipment: 'dumbbell' },
      ],
    },
  };
  const sets = (weight: number | null, reps: number, count: number) =>
    Array.from({ length: count }, (_, position) => ({ position, weight_kg: weight, reps, kind: 'working' }));
  const session = {
    status: 200,
    data: {
      strength: {
        exercises: [
          { id: 'e3', exercise_id: 'curl', position: 2, superset_group: 1, sets: sets(12, 10, 2) },
          { id: 'e1', exercise_id: 'bench', position: 0, superset_group: null, sets: sets(60, 8, 3) },
          { id: 'e2', exercise_id: 'pull', position: 1, superset_group: 1, sets: sets(null, 12, 2) },
        ],
      },
    },
  };
  const start = { userId: 'me', trackerId: 'gym', trackerName: 'Gym', upNext };

  beforeEach(() => {
    client = new QueryClient();
    jest.mocked(getSession).mockResolvedValue(session as never);
    jest.mocked(listExercises).mockResolvedValue(catalog as never);
    jest.mocked(lastSets).mockImplementation(async (id) =>
      id === 'bench' ? ({ status: 200, data: { sets: sets(62.5, 8, 4) } } as never) : Promise.reject(new Error('offline')),
    );
  });

  afterEach(() => {
    client.clear();
  });

  it('repeats the last workout: its name, exercises in order, supersets and the latest sets as ghosts', async () => {
    const prepared = await prepareWorkout(client, start, new Date('2026-11-26T18:00:00+01:00'));
    expect(prepared).toMatchObject({ userId: 'me', trackerId: 'gym', name: 'Upper body A', localDate: '2026-11-26', rest: null });
    expect(prepared.prefillFailed).toBeUndefined();
    expect(prepared.exercises.map((item) => [item.exerciseId, item.group, item.weighted, item.sets.length])).toEqual([
      ['bench', null, true, 4],
      ['pull', 1, false, 2],
      ['curl', 1, true, 2],
    ]);
    expect(prepared.exercises[0].sets[3].ghost).toEqual({ weightKg: 62.5, reps: 8 });
    expect(prepared.exercises[1].sets[0].ghost).toEqual({ weightKg: null, reps: 12 });
    expect(prepared.exercises[2].info).toEqual({ key: null, name: 'Spider curl', is_custom: true });
  });

  it('starts empty, saying so, when the last workout cannot be loaded', async () => {
    jest.mocked(getSession).mockRejectedValue(new Error('offline'));
    const prepared = await prepareWorkout(client, start);
    expect(prepared.exercises).toEqual([]);
    expect(prepared.prefillFailed).toBe(true);
  });

  it('starts empty under the tracker’s name before the first workout', async () => {
    const prepared = await prepareWorkout(client, { ...start, upNext: null });
    expect(prepared).toMatchObject({ name: 'Gym', exercises: [] });
    expect(getSession).not.toHaveBeenCalled();
  });
});
