import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuthStore } from '@/features/auth/store';
import { sessionKey, useOutbox } from '@/features/outbox/outbox';
import { usePreferences } from '@/features/settings/preferences';
import { useConnection } from '@/shared/api/connection';
import { ApiError } from '@/shared/api/fetcher';
import { lastSets, putExercise, useExerciseRecords, useListExercises } from '@/shared/api/generated/endpoints/exercises/exercises';
import { putSession, useListSessions } from '@/shared/api/generated/endpoints/sessions/sessions';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { ExerciseOut, GoalOut, RecordOut, SessionSaved, SessionWrite } from '@/shared/api/generated/model';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { type PreviousSet, type WorkoutDraft } from '../rules';
import { AddExerciseScreen } from '../screens/AddExerciseScreen';
import { SummaryScreen } from '../screens/SummaryScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { buildExercise, useWorkout, workout } from '../store';

const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), dismissTo: jest.fn(), replace: jest.fn(), back: jest.fn() },
  usePathname: () => '/workout',
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));
jest.mock('@/shared/api/generated/endpoints/sessions/sessions', () => ({
  putSession: jest.fn(),
  useListSessions: jest.fn(),
  getSession: jest.fn(),
  useGetSession: jest.fn(),
  getGetSessionQueryKey: (id: string) => [`/api/v1/sessions/${id}`],
}));
jest.mock('@/shared/api/generated/endpoints/exercises/exercises', () => ({
  useListExercises: jest.fn(),
  lastSets: jest.fn(),
  putExercise: jest.fn(),
  listExercises: jest.fn(),
  getListExercisesQueryKey: () => ['/api/v1/exercises'],
  useExerciseRecords: jest.fn(() => ({ data: undefined })),
  exerciseRecords: jest.fn(),
  getExerciseRecordsQueryKey: (id: string) => [`/api/v1/exercises/${id}/records`],
}));
jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ useReadMe: () => ({ data: { status: 200, data: { id: 'me' } } }) }));

let mockWidth = 390;
jest.mock('@/shared/theme/breakpoints', () => {
  const actual = jest.requireActual('@/shared/theme/breakpoints');
  return {
    ...actual,
    useBreakpoint: () => actual.breakpointFor(mockWidth),
    useTwoColumns: () => actual.hasTwoColumns(mockWidth),
    useSideColumn: (tablet: boolean) => actual.sideColumnFor(mockWidth, tablet),
  };
});

function exercise(id: string, key: string | null, muscle: string, equipment: string, overrides: Partial<ExerciseOut> = {}): ExerciseOut {
  return { id, key, name: null, is_custom: false, muscle_group: muscle, equipment, mechanic: 'compound', last_used_date: null, ...overrides } as ExerciseOut;
}

const CATALOG = [
  exercise('bench', 'bench_press', 'chest', 'barbell', { last_used_date: '2026-11-24' }),
  exercise('row', 'barbell_row', 'back', 'barbell'),
  exercise('pull', 'pull_up', 'back', 'bodyweight'),
  exercise('raise', 'lateral_raise', 'shoulders', 'dumbbell'),
];
const LAST: PreviousSet[] = [
  { weightKg: 60, reps: 8, kind: 'working' },
  { weightKg: 60, reps: 8, kind: 'working' },
];

function draft(exercises = [
  buildExercise({ exerciseId: 'bench', info: { key: 'bench_press', name: 'Bench press', is_custom: false }, weighted: true, previous: LAST }),
  buildExercise({ exerciseId: 'row', info: { key: 'barbell_row', name: 'Barbell row', is_custom: false }, weighted: true, previous: [LAST[0]] }),
]): WorkoutDraft {
  return {
    version: 1,
    id: 'session-1',
    userId: 'me',
    trackerId: 'gym',
    name: 'Upper body A',
    startedAt: new Date(Date.now() - 1122_000).toISOString(),
    localDate: '2026-11-26',
    exercises,
    rest: null,
  };
}

let client: QueryClient;

async function show(element: ReactElement) {
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{element}</ThemeProvider>
    </QueryClientProvider>,
  );
}

const state = () => useWorkout.getState();
const press = (element: Parameters<typeof fireEvent.press>[0]) => act(() => fireEvent.press(element));
const offlineError = () => new ApiError({ type: 'about:blank', title: 'Offline', status: 0, code: 'network_error' });

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockWidth = 390;
  client = new QueryClient();
  useAuthStore.setState({ status: 'signedIn' });
  useConnection.setState({ online: true, reachable: true });
  useOutbox.setState({ hydrated: true, items: [], syncing: false, retryAt: null });
  usePreferences.setState((current) => ({ values: { ...current.values, weight_unit: 'kg' } }));
  useWorkout.setState({ hydrated: true, draft: draft(), summary: null });
  jest.mocked(useExerciseRecords).mockImplementation(() => ({ data: undefined }) as never);
  jest.mocked(useListTrackers).mockReturnValue({
    data: { status: 200, data: { items: [{ id: 'gym', name: 'Gym', type: 'strength', archived: false }] } },
  } as unknown as ReturnType<typeof useListTrackers>);
  jest.mocked(useListExercises).mockReturnValue({
    isPending: false,
    data: { status: 200, data: { items: CATALOG } },
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useListExercises>);
});

afterEach(() => {
  client.clear();
});

describe('Workout', () => {
  it('shows the name, the time so far and each exercise with last time’s sets as ghosts', async () => {
    await show(<WorkoutScreen />);

    expect(screen.getByText('Upper body A')).toBeTruthy();
    expect(screen.getByText(/18:4\d elapsed/)).toBeTruthy();
    expect(screen.getByText('Bench press')).toBeTruthy();
    expect(screen.getByText('Barbell row')).toBeTruthy();
    expect(screen.getAllByText('60 × 8')).toHaveLength(3);
    expect(screen.getByLabelText('Bench press, Set 1, weight in kg').props.placeholder).toBe('60');
    expect(screen.getByLabelText('Bench press, Set 1, reps').props.placeholder).toBe('8');
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
  });

  it('checks a set with last time’s values, locks it and starts a 90 s rest with +30s and Skip', async () => {
    await show(<WorkoutScreen />);

    await press(screen.getByRole('checkbox', { name: 'Bench press, Set 1, done' }));
    expect(screen.getByRole('checkbox', { name: 'Bench press, Set 1, done', checked: true })).toBeTruthy();
    expect(state().draft?.exercises[0].sets[0]).toMatchObject({ weightKg: 60, reps: 8, done: true });
    expect(screen.getByLabelText('Bench press, Set 1, weight in kg').props.editable).toBe(false);
    expect(screen.getByText('01:30')).toBeTruthy();
    expect(screen.getByText('Rest · of 90 seconds')).toBeTruthy();

    await press(screen.getByRole('button', { name: 'Add 30 seconds' }));
    expect(screen.getByText('Rest · of 120 seconds')).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Skip rest' }));
    expect(screen.queryByText(/Rest · of/)).toBeNull();
  });

  it('shows a record as soon as a checked set beats the exercise’s bests, never on a tie or a first time', async () => {
    const best = (record_type: RecordOut['record_type'], value: number) =>
      ({ exercise_id: 'bench', record_type, value, weight_kg: 60, reps: 8, session_id: 'old', local_date: '2026-11-20' }) as RecordOut;
    jest.mocked(useExerciseRecords).mockImplementation(
      (id) =>
        ({
          data: {
            status: 200,
            data:
              id === 'bench'
                ? { exercise_id: 'bench', max_weight: best('max_weight', 60), max_reps: best('max_reps', 8), estimated_1rm: best('estimated_1rm', 76) }
                : { exercise_id: id, max_weight: null, max_reps: null, estimated_1rm: null },
          },
        }) as never,
    );
    await show(<WorkoutScreen />);

    await press(screen.getByRole('checkbox', { name: 'Bench press, Set 1, done' }));
    expect(screen.queryByText(/Max weight/)).toBeNull();
    await press(screen.getByRole('checkbox', { name: 'Barbell row, Set 1, done' }));
    expect(screen.queryByText(/Max weight/)).toBeNull();

    await act(() => fireEvent.changeText(screen.getByLabelText('Bench press, Set 2, weight in kg'), '62.5'));
    await press(screen.getByRole('checkbox', { name: 'Bench press, Set 2, done' }));
    expect(screen.getByText('Max weight · 62.5 kg')).toBeTruthy();
    expect(screen.getByText('Max reps · 8 at 62.5 kg')).toBeTruthy();
    expect(screen.getByText('Estimated 1RM · 79.2 kg')).toBeTruthy();
    expect(screen.getByLabelText('New personal record: Max weight · 62.5 kg')).toBeTruthy();

    await press(screen.getByRole('checkbox', { name: 'Bench press, Set 2, done' }));
    expect(screen.queryByText(/Max weight/)).toBeNull();
  });

  it('takes typed weight and reps, in pounds too', async () => {
    usePreferences.setState((current) => ({ values: { ...current.values, weight_unit: 'lb' } }));
    await show(<WorkoutScreen />);

    expect(screen.getByLabelText('Bench press, Set 1, weight in lb').props.placeholder).toBe('132.28');
    await act(() => fireEvent.changeText(screen.getByLabelText('Bench press, Set 1, weight in lb'), '135'));
    await act(() => fireEvent.changeText(screen.getByLabelText('Bench press, Set 1, reps'), '6x'));
    expect(state().draft?.exercises[0].sets[0]).toMatchObject({ weightKg: 61.235, reps: 6 });
  });

  it('asks for the missing numbers before a set without history can be checked', async () => {
    useWorkout.setState({
      draft: draft([buildExercise({ exerciseId: 'raise', info: { key: 'lateral_raise', name: null, is_custom: false }, weighted: true, previous: [] })]),
    });
    await show(<WorkoutScreen />);

    await press(screen.getByRole('checkbox', { name: 'Lateral raise, Set 1, done' }));
    expect(screen.getByText('Enter the weight and reps to check this set.')).toBeTruthy();
    expect(state().draft?.exercises[0].sets[0].done).toBe(false);
  });

  it('groups an exercise with the next one into a superset, and takes it out again', async () => {
    await show(<WorkoutScreen />);

    await press(screen.getByRole('button', { name: 'Bench press, options' }));
    await press(screen.getByRole('button', { name: 'Superset with next exercise' }));
    expect(screen.getByText('Superset')).toBeTruthy();
    expect(screen.getByLabelText('Superset: Bench press + Barbell row')).toBeTruthy();
    expect(state().draft?.exercises.map((item) => item.group)).toEqual([1, 1]);

    await press(screen.getByRole('checkbox', { name: 'Bench press, Set 1, done' }));
    expect(screen.queryByText(/Rest · of/)).toBeNull();
    await press(screen.getByRole('checkbox', { name: 'Barbell row, Set 1, done' }));
    expect(screen.getByText('Rest · of 90 seconds')).toBeTruthy();

    await press(screen.getByRole('button', { name: 'Barbell row, options' }));
    await press(screen.getByRole('button', { name: 'Remove from superset' }));
    expect(screen.queryByText('Superset')).toBeNull();
  });

  it('marks a warm-up, removes a set and asks before removing an exercise with checked sets', async () => {
    await show(<WorkoutScreen />);

    await press(screen.getByRole('button', { name: 'Bench press, Set 1, options' }));
    await press(screen.getByRole('button', { name: 'Mark as warm-up' }));
    expect(screen.getByText('W')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Bench press, Warm-up set, done' })).toBeTruthy();

    await press(screen.getByRole('button', { name: 'Bench press, Set 1, options' }));
    await press(screen.getByRole('button', { name: 'Remove set' }));
    expect(state().draft?.exercises[0].sets).toHaveLength(1);

    await press(screen.getByRole('checkbox', { name: 'Bench press, Warm-up set, done' }));
    await press(screen.getByRole('button', { name: 'Bench press, options' }));
    await press(screen.getByRole('button', { name: 'Remove exercise' }));
    expect(screen.getByText('Its checked set goes with it.')).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Remove exercise' }));
    expect(state().draft?.exercises.map((item) => item.exerciseId)).toEqual(['row']);
  });

  it('finishes with the checked sets only and opens the summary', async () => {
    const saved = { session: { id: 'session-1' }, new_records: [], goals: [] } as unknown as SessionSaved;
    jest.mocked(putSession).mockResolvedValue({ status: 201, data: saved, headers: new Headers() } as never);
    await show(<WorkoutScreen />);

    await press(screen.getByRole('checkbox', { name: 'Bench press, Set 1, done' }));
    await press(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('Finish this workout?')).toBeTruthy();
    expect(screen.getByText('1 completed set will be saved. 2 unfinished sets won’t count.')).toBeTruthy();
    expect(screen.getByLabelText('Completed: 1 set')).toBeTruthy();

    await press(screen.getByRole('button', { name: 'Finish & see summary' }));
    const [id, body] = jest.mocked(putSession).mock.calls[0];
    expect(id).toBe('session-1');
    expect(body.strength?.exercises).toEqual([
      expect.objectContaining({ exercise_id: 'bench', position: 0, sets: [{ position: 0, weight_kg: 60, reps: 8, kind: 'working' }] }),
    ]);
    expect(state()).toMatchObject({ draft: null, summary: { userId: 'me', trackerName: 'Gym', saved } });
    expect(mockRedirect).toHaveBeenCalledWith('/workout/summary');
  });

  it('saves the workout on the device when the server cannot be reached and opens the summary', async () => {
    jest.mocked(putSession).mockRejectedValue(offlineError());
    await show(<WorkoutScreen />);

    await press(screen.getByRole('checkbox', { name: 'Barbell row, Set 1, done' }));
    await press(screen.getByRole('button', { name: 'Finish' }));
    await press(screen.getByRole('button', { name: 'Finish & see summary' }));
    expect(state()).toMatchObject({ draft: null, summary: { sessionId: 'session-1', saved: null } });
    expect(state().summary?.body.strength?.exercises).toHaveLength(1);
    expect(useOutbox.getState().items).toEqual([expect.objectContaining({ kind: 'session', id: 'session-1', userId: 'me', failure: null })]);
    expect(useOutbox.getState().retryAt).not.toBeNull();
    expect(await AsyncStorage.getItem(sessionKey('session-1'))).not.toBeNull();
  });

  it('says before Finish that an offline workout is saved on the device', async () => {
    useConnection.setState({ online: false });
    await show(<WorkoutScreen />);

    await press(screen.getByRole('checkbox', { name: 'Barbell row, Set 1, done' }));
    await press(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('The workout will be saved on this device and synced when you’re back online.')).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Finish & see summary' }));
    expect(putSession).not.toHaveBeenCalled();
    expect(state().summary?.saved).toBeNull();
  });

  it('stays open when the server refuses the workout because its tracker is gone', async () => {
    jest.mocked(putSession).mockRejectedValue(
      new ApiError({
        type: 'about:blank',
        title: 'Invalid',
        status: 422,
        code: 'validation_error',
        errors: [{ field: 'tracker_id', code: 'not_found', message: 'Tracker not found.' }],
      }),
    );
    await show(<WorkoutScreen />);

    await press(screen.getByRole('checkbox', { name: 'Barbell row, Set 1, done' }));
    await press(screen.getByRole('button', { name: 'Finish' }));
    await press(screen.getByRole('button', { name: 'Finish & see summary' }));
    expect(screen.getByText(/The tracker of this workout was deleted/)).toBeTruthy();
    expect(state().draft).not.toBeNull();
    expect(useOutbox.getState().items).toEqual([]);
  });

  it('cannot finish before a set is checked', async () => {
    await show(<WorkoutScreen />);
    await press(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText(/Check at least one set to finish/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Finish & see summary' })).toBeNull();
  });

  it('renames the workout and discards it after asking', async () => {
    await show(<WorkoutScreen />);

    await press(screen.getByRole('button', { name: 'Workout options' }));
    await press(screen.getByRole('button', { name: 'Rename workout' }));
    await act(() => fireEvent.changeText(screen.getByLabelText('Workout name'), 'Push day'));
    await press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Push day')).toBeTruthy();

    await press(screen.getByRole('button', { name: 'Workout options' }));
    await press(screen.getByRole('button', { name: 'Discard workout' }));
    expect(screen.getByText('Discard this workout?')).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Discard workout' }));
    expect(state().draft).toBeNull();
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('starts empty with a way to add exercises, and says when last time could not be loaded', async () => {
    useWorkout.setState({ draft: { ...draft([]), prefillFailed: true } });
    await show(<WorkoutScreen />);

    expect(screen.getByText('Couldn’t load your last workout.')).toBeTruthy();
    expect(screen.getByText('Ready when you are.')).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Add exercise' }));
    expect(router.push).toHaveBeenCalledWith('/workout/add-exercise');
  });

  it('puts the rest timer, the session so far and Discard beside the workout on desktop', async () => {
    mockWidth = 1440;
    await show(<WorkoutScreen />);

    await press(screen.getByRole('checkbox', { name: 'Bench press, Set 1, done' }));
    expect(screen.getByText('Session so far')).toBeTruthy();
    expect(screen.getByLabelText('Volume · kg: 480')).toBeTruthy();
    expect(screen.getByLabelText('1 of 3 sets done')).toBeTruthy();
    expect(screen.getByText('Your last session, in view.')).toBeTruthy();
    expect(screen.getByText('Rest · of 90 seconds')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard workout' })).toBeTruthy();
  });

  it('leads back to Home when the workout ended elsewhere', async () => {
    useWorkout.setState({ draft: null });
    await show(<WorkoutScreen />);

    expect(screen.getByText('No workout in progress')).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Back to Home' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });
});

describe('Add exercise', () => {
  it('finds exercises by name and muscle group, the ones used before first', async () => {
    await show(<AddExerciseScreen />);

    expect(screen.getByText('Find your next movement')).toBeTruthy();
    expect(screen.getByLabelText('Bench press, Chest, Barbell, Last used Nov 24')).toBeTruthy();
    await act(() => fireEvent.changeText(screen.getByLabelText('Search exercises'), 'ROW'));
    expect(screen.getByText('Barbell row')).toBeTruthy();
    expect(screen.queryByText('Bench press')).toBeNull();

    await act(() => fireEvent.changeText(screen.getByLabelText('Search exercises'), ''));
    await press(screen.getByRole('radio', { name: 'Back' }));
    expect(screen.getByText('Pull-up')).toBeTruthy();
    expect(screen.queryByText('Lateral raise')).toBeNull();
  });

  it('adds the picked exercises at the end with last time’s sets', async () => {
    jest.mocked(lastSets).mockImplementation(async (id) =>
      id === 'pull'
        ? ({ status: 200, data: { sets: [{ position: 0, weight_kg: null, reps: 12, kind: 'working' }] } } as never)
        : Promise.reject(new Error('offline')),
    );
    await show(<AddExerciseScreen />);

    await press(screen.getByRole('checkbox', { name: /^Pull-up/ }));
    await press(screen.getByRole('checkbox', { name: /^Lateral raise/ }));
    await press(screen.getByRole('button', { name: 'Add 2 exercises' }));
    const added = state().draft?.exercises.slice(2) ?? [];
    expect(added.map((item) => [item.exerciseId, item.weighted, item.sets.length, item.sets[0].ghost])).toEqual([
      ['pull', false, 1, { weightKg: null, reps: 12 }],
      ['raise', true, 1, null],
    ]);
    expect(router.dismissTo).toHaveBeenCalledWith('/workout');
  });

  it('creates an exercise offline, lists it at once and keeps it for the outbox', async () => {
    jest.mocked(putExercise).mockImplementation(async () => {
      useConnection.setState({ reachable: false });
      throw offlineError();
    });
    await show(<AddExerciseScreen />);

    await act(() => fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Spider curl'));
    await press(screen.getByRole('button', { name: 'Create “Spider curl”' }));
    await press(screen.getByRole('button', { name: 'Create exercise' }));

    expect(useOutbox.getState().items).toEqual([
      expect.objectContaining({ kind: 'exercise', userId: 'me', body: { name: 'Spider curl', muscle_group: 'chest', equipment: 'barbell' } }),
    ]);
    expect(screen.getByRole('checkbox', { name: /^Spider curl, Chest, Barbell, Your exercise/, checked: true })).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Add selected exercise' }));
    expect(state().draft?.exercises.at(-1)).toMatchObject({ info: { key: null, name: 'Spider curl', is_custom: true }, weighted: true });
    expect(lastSets).not.toHaveBeenCalled();
  });

  it('creates an exercise the catalog lacks and picks it', async () => {
    const created = exercise('spider', null, 'arms', 'dumbbell', { name: 'Spider curl', is_custom: true });
    jest.mocked(putExercise).mockResolvedValue({ status: 201, data: created, headers: new Headers() } as never);
    await show(<AddExerciseScreen />);

    await act(() => fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Spider curl'));
    expect(screen.getByText('No exercise matches “Spider curl”.')).toBeTruthy();
    await press(screen.getByRole('button', { name: 'Create “Spider curl”' }));
    await press(screen.getAllByRole('radio', { name: 'Arms' }).at(-1)!);
    await press(screen.getByRole('radio', { name: 'Dumbbell' }));
    await press(screen.getByRole('button', { name: 'Create exercise' }));

    const [id, body] = jest.mocked(putExercise).mock.calls[0];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).toEqual({ name: 'Spider curl', muscle_group: 'arms', equipment: 'dumbbell' });
    expect(screen.getByRole('button', { name: 'Add selected exercise', disabled: false })).toBeTruthy();
  });
});

describe('Summary', () => {
  const record = (record_type: RecordOut['record_type'], value: number, weight_kg: number | null, reps: number): RecordOut => ({
    exercise_id: 'bench',
    record_type,
    value,
    weight_kg,
    reps,
    session_id: 'session-1',
    local_date: '2026-11-26',
  });
  const goal = {
    id: 'weekly',
    tracker_id: 'gym',
    kind: 'frequency',
    period: 'week',
    metric: 'sessions',
    is_pinned: true,
    target: 3,
    progress: { value: 3, target: 3 },
    streak_weeks: 5,
  } as unknown as GoalOut;
  const session = {
    id: 'session-1',
    tracker_id: 'gym',
    started_at: '2026-11-26T17:00:00Z',
    local_date: '2026-11-26',
    duration_s: 2892,
    name: 'Upper body A',
    note: null,
    strength: { exercises: [] },
    stats: { volume_kg: 4820, working_sets: 12 },
  };
  const saved = (overrides: Partial<SessionSaved> = {}) =>
    ({
      session,
      new_records: [record('max_weight', 62.5, 62.5, 8), record('max_reps', 10, 60, 10), record('estimated_1rm', 83.33, 62.5, 10)],
      goals: [goal],
      ...overrides,
    }) as unknown as SessionSaved;
  const previous = (items: { id: string; started_at: string; headline: { metric: string; value: number } }[]) =>
    jest.mocked(useListSessions).mockReturnValue({ data: { status: 200, data: { items } } } as unknown as ReturnType<typeof useListSessions>);

  const body: SessionWrite = {
    tracker_id: 'gym',
    started_at: '2026-11-26T17:00:00Z',
    local_date: '2026-11-26',
    duration_s: 2892,
    name: 'Upper body A',
    note: null,
    strength: {
      exercises: [
        {
          id: 'entry',
          exercise_id: 'bench',
          position: 0,
          sets: [
            { position: 0, weight_kg: 40, reps: 10, kind: 'warmup' },
            { position: 1, weight_kg: 62.5, reps: 8, kind: 'working' },
            { position: 2, weight_kg: 60, reps: 10, kind: 'working' },
          ],
        },
      ],
    },
  };
  const summary = (savedAnswer: SessionSaved | null) => ({ userId: 'me', trackerName: 'Gym', sessionId: 'session-1', body, saved: savedAnswer });

  beforeEach(() => {
    useWorkout.setState({ draft: null, summary: summary(saved()) });
    previous([
      { id: 'session-1', started_at: '2026-11-26T17:00:00Z', headline: { metric: 'volume_kg', value: 4820 } },
      { id: 'older', started_at: '2026-11-24T17:00:00Z', headline: { metric: 'volume_kg', value: 4460 } },
    ]);
  });

  it('shows the session, how it compares, the records it set and the weekly goal', async () => {
    await show(<SummaryScreen />);

    expect(screen.getByText('Stronger than yesterday.')).toBeTruthy();
    expect(screen.getByLabelText('Duration: 48:12')).toBeTruthy();
    expect(screen.getByLabelText('Volume · kg: 4,820')).toBeTruthy();
    expect(screen.getByLabelText('Sets: 12')).toBeTruthy();
    expect(screen.getByText('A solid session. You moved 360 kg more than last time.')).toBeTruthy();
    expect(screen.getByText('3 new personal records')).toBeTruthy();
    expect(screen.getByText('Max weight · 62.5 kg')).toBeTruthy();
    expect(screen.getByText('Max reps · 10 at 60 kg')).toBeTruthy();
    expect(screen.getByText('Estimated 1RM · 83.3 kg')).toBeTruthy();
    expect(screen.getByText('Bench press · compared with all completed sessions')).toBeTruthy();
    expect(screen.getByText('Weekly goal, done.')).toBeTruthy();
    expect(screen.getByText('3 of 3 workouts this week · 5-week streak')).toBeTruthy();
  });

  it('marks a first workout as the baseline', async () => {
    useWorkout.setState({ summary: summary(saved({ new_records: [], goals: [] })) });
    previous([{ id: 'session-1', started_at: '2026-11-26T17:00:00Z', headline: { metric: 'volume_kg', value: 4820 } }]);
    await show(<SummaryScreen />);

    expect(screen.getByText('Another one done.')).toBeTruthy();
    expect(screen.getByText('Your first workout here sets the baseline for records.')).toBeTruthy();
    expect(screen.queryByText(/personal record/)).toBeNull();
  });

  it('saves the note with the session on Done and returns to Home', async () => {
    jest.mocked(putSession).mockResolvedValue({ status: 200, data: saved(), headers: new Headers() } as never);
    await show(<SummaryScreen />);

    await act(() => fireEvent.changeText(screen.getByLabelText('Session note'), 'Felt strong on the last set.'));
    await press(screen.getByRole('button', { name: 'Done' }));
    expect(jest.mocked(putSession).mock.calls[0][1]).toMatchObject({ tracker_id: 'gym', note: 'Felt strong on the last set.' });
    expect(router.dismissTo).toHaveBeenCalledWith('/');
    expect(state().summary).toBeNull();
  });

  it('keeps a note on the device when the server cannot be reached', async () => {
    jest.mocked(putSession).mockRejectedValue(offlineError());
    await show(<SummaryScreen />);

    await act(() => fireEvent.changeText(screen.getByLabelText('Session note'), 'Felt strong.'));
    await press(screen.getByRole('button', { name: 'Save note' }));
    expect(screen.getByText('Note saved on this device')).toBeTruthy();
    expect(useOutbox.getState().items).toEqual([expect.objectContaining({ id: 'session-1', body: { ...body, note: 'Felt strong.' } })]);
    await press(screen.getByRole('button', { name: 'Done' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('stays when the server refuses the note', async () => {
    jest.mocked(putSession).mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Not found', status: 404, code: 'not_found' }));
    await show(<SummaryScreen />);

    await act(() => fireEvent.changeText(screen.getByLabelText('Session note'), 'Felt strong.'));
    await press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Couldn’t save the note. Try again.')).toBeTruthy();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(state().summary).not.toBeNull();
    expect(useOutbox.getState().items).toEqual([]);
  });

  it('counts the records on the device while the workout waits, until the server’s answer', async () => {
    client.setQueryData(['/api/v1/exercises/bench/records'], {
      status: 200,
      data: { exercise_id: 'bench', max_weight: record('max_weight', 60, 60, 8), max_reps: record('max_reps', 8, 60, 8), estimated_1rm: record('estimated_1rm', 76, 60, 8) },
    });
    useWorkout.setState({ summary: summary(null) });
    await show(<SummaryScreen />);

    expect(screen.getByText('Stronger than yesterday.')).toBeTruthy();
    expect(screen.getByText('3 new personal records')).toBeTruthy();
    expect(screen.getByText('Max reps · 10 at 60 kg')).toBeTruthy();
    expect(screen.getByText('Estimated 1RM · 80 kg')).toBeTruthy();
    expect(screen.getByText('Counted on this device. Confirmed once the workout is sent.')).toBeTruthy();

    await act(() => workout.sessionSaved(saved({ new_records: [record('max_weight', 62.5, 62.5, 8)] })));
    expect(screen.getByText('A new personal record')).toBeTruthy();
    expect(screen.queryByText(/Counted on this device/)).toBeNull();
  });

  it('shows the device’s numbers while the workout waits, and the records once it is sent', async () => {
    useWorkout.setState({ summary: summary(null) });
    await show(<SummaryScreen />);

    expect(screen.getByText('Another one done.')).toBeTruthy();
    expect(screen.getByText('Saved on this device.')).toBeTruthy();
    expect(screen.getByLabelText('Volume · kg: 1,100')).toBeTruthy();
    expect(screen.getByLabelText('Sets: 2')).toBeTruthy();
    expect(screen.queryByText(/personal record/)).toBeNull();

    await act(() => workout.sessionSaved(saved()));
    expect(screen.getByText('Stronger than yesterday.')).toBeTruthy();
    expect(screen.queryByText('Saved on this device.')).toBeNull();
    expect(screen.getByText('3 new personal records')).toBeTruthy();
    expect(screen.getByText('Weekly goal, done.')).toBeTruthy();
  });
});
