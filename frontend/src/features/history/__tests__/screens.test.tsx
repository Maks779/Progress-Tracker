import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { useOutbox } from '@/features/outbox/outbox';
import { useChooser } from '@/features/quicklog/chooser';
import { usePreferences } from '@/features/settings/preferences';
import { useConnection } from '@/shared/api/connection';
import { ApiError } from '@/shared/api/fetcher';
import { useListBooks } from '@/shared/api/generated/endpoints/books/books';
import { useListExercises } from '@/shared/api/generated/endpoints/exercises/exercises';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import {
  deleteSession,
  listSessions,
  putSession,
  restoreSession,
  useGetSession,
  useListSessions,
} from '@/shared/api/generated/endpoints/sessions/sessions';
import { useCalendar } from '@/shared/api/generated/endpoints/stats/stats';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { ExerciseOut, GoalOut, SessionListItem, SessionOut, TrackerSummary } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';
import { ToastHost } from '@/shared/ui/Toast';

import { addDays, weekOf } from '../rules';
import { EditSessionScreen } from '../screens/EditSessionScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SessionScreen } from '../screens/SessionScreen';

let mockId = 's1';
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), dismissTo: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  usePathname: () => '/history',
  useLocalSearchParams: () => ({ id: mockId }),
  useNavigation: () => ({ navigate: jest.fn() }),
  Redirect: () => null,
}));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ useReadMe: () => ({ data: { status: 200, data: { id: 'me' } } }) }));
jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/goals/goals', () => ({ useListGoals: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/stats/stats', () => ({ useCalendar: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/books/books', () => ({
  useListBooks: jest.fn(),
  putBook: jest.fn(),
  getListBooksQueryKey: () => ['/api/v1/books'],
}));
jest.mock('@/shared/api/generated/endpoints/exercises/exercises', () => ({ useListExercises: jest.fn(), putExercise: jest.fn(), lastSets: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/sessions/sessions', () => ({
  useListSessions: jest.fn(),
  useGetSession: jest.fn(),
  listSessions: jest.fn(),
  putSession: jest.fn(),
  deleteSession: jest.fn(),
  restoreSession: jest.fn(),
  getListSessionsQueryKey: (params: unknown) => ['/api/v1/sessions', params],
  getGetSessionQueryKey: (id: string) => [`/api/v1/sessions/${id}`],
}));

const today = toIsoDate(new Date());
const thisWeek = weekOf(today);

function tracker(id: string, overrides: Partial<TrackerSummary>): TrackerSummary {
  return { id, name: id, type: 'general', general_mode: null, counter_unit: null, color: 'general', icon: 'sparkles', position: 0, archived: false, ...overrides } as TrackerSummary;
}

const TRACKERS = [
  tracker('gym', { name: 'Gym', type: 'strength', color: 'strength', icon: 'dumbbell', position: 0 }),
  tracker('run', { name: 'Running', type: 'cardio', color: 'cardio', icon: 'activity', position: 1 }),
  tracker('read', { name: 'Reading', type: 'reading', color: 'reading', icon: 'book-open', position: 2 }),
  tracker('swim', { name: 'Swimming', type: 'cardio', color: 'cardio', icon: 'waves', position: 3, archived: true }),
];
const CATALOG = [
  ['bench', 'bench_press'],
  ['row', 'barbell_row'],
  ['raise', 'lateral_raise'],
  ['curl', 'cable_curl'],
].map(([id, key]) => ({ id, key, name: null, is_custom: false, equipment: 'barbell', muscle_group: 'chest' }) as unknown as ExerciseOut);

const sets = (weight: number | null, reps: number, count: number) =>
  Array.from({ length: count }, (_, position) => ({ position, weight_kg: weight, reps, kind: 'working' as const }));

const WORKOUT = {
  id: 's1',
  tracker_id: 'gym',
  tracker_type: 'strength',
  name: 'Upper body A',
  note: 'Felt strong on the last set.',
  started_at: new Date().toISOString(),
  local_date: today,
  duration_s: 2892,
  record_count: 3,
  cardio: null,
  reading: null,
  general: null,
  stats: { volume_kg: 4340, working_sets: 12, pages_read: null, pace_s_per_km: null },
  strength: {
    exercises: [
      {
        id: 'e1',
        exercise_id: 'bench',
        position: 0,
        superset_group: null,
        sets: [
          { position: 0, weight_kg: 40, reps: 10, kind: 'warmup' as const },
          { position: 1, weight_kg: 62.5, reps: 8, kind: 'working' as const },
          { position: 2, weight_kg: 60, reps: 8, kind: 'working' as const },
        ],
      },
      { id: 'e2', exercise_id: 'row', position: 1, superset_group: null, sets: sets(50, 10, 3) },
      { id: 'e3', exercise_id: 'raise', position: 2, superset_group: 1, sets: sets(10, 12, 3) },
      { id: 'e4', exercise_id: 'curl', position: 3, superset_group: 1, sets: sets(25, 12, 3) },
    ],
  },
} as unknown as SessionOut;
const RUN = {
  ...WORKOUT,
  id: 'r1',
  tracker_id: 'run',
  tracker_type: 'cardio',
  name: null,
  note: null,
  started_at: '2026-11-26T16:00:00.000Z',
  local_date: '2026-11-26',
  duration_s: 1920,
  record_count: 0,
  strength: null,
  cardio: { distance_m: 5200 },
  stats: { volume_kg: null, working_sets: null, pages_read: null, pace_s_per_km: 369 },
} as unknown as SessionOut;
const SESSIONS: Record<string, SessionOut> = { s1: WORKOUT, r1: RUN };

const item = (overrides: Partial<SessionListItem>): SessionListItem =>
  ({
    id: 's1',
    tracker_id: 'gym',
    tracker_type: 'strength',
    name: 'Upper body A',
    started_at: new Date().toISOString(),
    local_date: today,
    duration_s: 2880,
    headline: { metric: 'volume_kg', value: 4820 },
    ...overrides,
  }) as SessionListItem;

let client: QueryClient;

function serve({ hasSessions = true } = {}) {
  jest.mocked(useListTrackers).mockReturnValue({ isPending: false, data: { status: 200, data: { items: TRACKERS } } } as never);
  jest.mocked(useListGoals).mockReturnValue({
    data: { status: 200, data: { items: [{ id: 'g', tracker_id: 'gym', kind: 'frequency', period: 'week', metric: 'sessions', progress: { value: 1, target: 3 } } as GoalOut] } },
  } as never);
  jest.mocked(useListBooks).mockReturnValue({ isError: false, data: { status: 200, data: { items: [] } } } as never);
  jest.mocked(useListExercises).mockReturnValue({ isPending: false, isError: false, data: { status: 200, data: { items: CATALOG } } } as never);
  jest.mocked(useListSessions).mockReturnValue({ isError: false, data: { status: 200, data: { items: hasSessions ? [item({})] : [] } } } as never);
  jest.mocked(useCalendar).mockImplementation(
    (params) =>
      ({
        data: {
          status: 200,
          data: { month: params.month, days: [{ local_date: today, tracker_types: ['strength', 'reading'] }], session_count: 4, active_time_s: 15_120 },
        },
      }) as never,
  );
  jest.mocked(listSessions).mockImplementation(async (params) => {
    const items = params?.from_date === thisWeek.from ? [item({}), item({ id: 'r1', tracker_id: 'run', tracker_type: 'cardio', name: 'Running', duration_s: 1920, headline: { metric: 'distance_m', value: 5200 } })] : [];
    const kept = params?.tracker_id ? items.filter((entry) => entry.tracker_id === params.tracker_id) : items;
    return { status: 200, data: { items: kept, next_cursor: null } } as never;
  });
  jest.mocked(useGetSession).mockImplementation((id) => ({ isPending: false, data: SESSIONS[id] ? { status: 200, data: SESSIONS[id] } : undefined }) as never);
}

async function show(element: ReactElement) {
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        {element}
        <ToastHost />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const press = (name: string | RegExp) => act(() => fireEvent.press(screen.getByRole('button', { name })));

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  client = new QueryClient();
  mockId = 's1';
  useAuthStore.setState({ status: 'signedIn' });
  useConnection.setState({ online: true, reachable: true });
  useOutbox.setState({ hydrated: true, items: [], syncing: false, retryAt: null });
  useChooser.setState({ open: false, showTab: null });
  usePreferences.setState((current) => ({ values: { ...current.values, distance_unit: 'km', weight_unit: 'kg' } }));
  serve();
});

afterEach(() => {
  client.clear();
});

describe('History', () => {
  it('shows the month with its markers and this week’s sessions, which open their detail', async () => {
    await show(<HistoryScreen />);
    const month = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date());
    expect(screen.getByText(month)).toBeTruthy();
    expect(screen.getByRole('radio', { name: new RegExp(`, Strength, Reading, today$`), checked: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next month', disabled: true })).toBeTruthy();
    expect(await screen.findByText('This week')).toBeTruthy();
    expect(await screen.findByText('2 sessions')).toBeTruthy();
    await act(() => fireEvent.press(screen.getByRole('link', { name: /^Upper body A, Today · 48 min, 4,820 kg$/ })));
    expect(router.push).toHaveBeenCalledWith('/history/s1');
    expect(screen.getByText('Month in review')).toBeTruthy();
  });

  it('shows the week of the day chosen and keeps one tracker', async () => {
    await show(<HistoryScreen />);
    await screen.findByText('2 sessions');
    const lastMonday = addDays(thisWeek.from, -7);
    if (lastMonday.slice(0, 7) === today.slice(0, 7)) {
      const name = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' }).format(new Date(`${lastMonday}T12:00:00`));
      await act(() => fireEvent.press(screen.getByRole('radio', { name: new RegExp(`^Monday, ${name},`) })));
      expect(await screen.findByText('Last week')).toBeTruthy();
      expect(await screen.findByText('No sessions this week.')).toBeTruthy();
      expect(listSessions).toHaveBeenCalledWith(expect.objectContaining({ from_date: lastMonday }));
    }
    await act(() => fireEvent.press(screen.getByRole('radio', { name: 'Running' })));
    expect(useCalendar).toHaveBeenLastCalledWith(expect.objectContaining({ tracker_id: 'run' }), expect.anything());
    await act(() => fireEvent.press(screen.getByRole('radio', { name: 'More' })));
    await act(() => fireEvent.press(screen.getByRole('radio', { name: 'Swimming, Archived' })));
    expect(screen.getByRole('radio', { name: 'Swimming', checked: true })).toBeTruthy();
  });

  it('invites a first session when there is none', async () => {
    serve({ hasSessions: false });
    await show(<HistoryScreen />);
    expect(screen.getByText('Your story starts with a session.')).toBeTruthy();
    await press('Log your first session');
    expect(useChooser.getState().open).toBe(true);
  });

  it('says so when it cannot load', async () => {
    jest.mocked(useListTrackers).mockReturnValue({ isPending: false, isError: true, data: undefined, refetch: jest.fn() } as never);
    await show(<HistoryScreen />);
    expect(screen.getByText('Couldn’t load history.')).toBeTruthy();
  });
});

describe('A session', () => {
  it('shows a workout’s numbers, sets, superset, note and weekly goal', async () => {
    await show(<SessionScreen />);
    expect(screen.getByText('Upper body A')).toBeTruthy();
    expect(screen.getByText('48:12')).toBeTruthy();
    expect(screen.getByText('3 personal records')).toBeTruthy();
    expect(screen.getByText('62.5 kg × 8 reps')).toBeTruthy();
    expect(screen.getByText('W')).toBeTruthy();
    expect(screen.getByText('3 × 10 at 50 kg · 1,500 kg volume')).toBeTruthy();
    expect(screen.getByText('Lateral raise + Cable curl')).toBeTruthy();
    expect(screen.getByText('6 sets · 1,260 kg volume')).toBeTruthy();
    expect(screen.getByText('Felt strong on the last set.')).toBeTruthy();
  });

  it('shows a run’s distance and pace', async () => {
    mockId = 'r1';
    await show(<SessionScreen />);
    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByText('32:00')).toBeTruthy();
    expect(screen.getByText('5.2')).toBeTruthy();
    expect(screen.getByText('6:09')).toBeTruthy();
  });

  it('deletes at once and brings it back with Undo', async () => {
    jest.mocked(deleteSession).mockResolvedValue({ status: 204 } as never);
    jest.mocked(restoreSession).mockResolvedValue({ status: 200, data: WORKOUT } as never);
    await show(<SessionScreen />);
    await press('Delete');
    expect(deleteSession).toHaveBeenCalledWith('s1');
    expect(router.dismissTo).toHaveBeenCalledWith('/history');
    expect(screen.getByText('Session removed')).toBeTruthy();
    await press('Undo');
    expect(restoreSession).toHaveBeenCalledWith('s1');
    expect(await screen.findByText('Session restored.')).toBeTruthy();
  });

  it('says when Undo cannot bring a reading back', async () => {
    jest.mocked(deleteSession).mockResolvedValue({ status: 204 } as never);
    jest.mocked(restoreSession).mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Conflict', status: 409, code: 'conflict' } as never));
    await show(<SessionScreen />);
    await press('Delete');
    await press('Undo');
    expect(await screen.findByText(/can’t come back/)).toBeTruthy();
  });

  it('cannot be changed offline', async () => {
    useConnection.setState({ online: false });
    await show(<SessionScreen />);
    expect(screen.getByText('You’re offline. Editing and deleting need a connection.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete', disabled: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit session', disabled: true })).toBeTruthy();
  });

  it('says when it is gone', async () => {
    jest.mocked(useGetSession).mockReturnValue({
      isPending: false,
      data: undefined,
      error: new ApiError({ type: 'about:blank', title: 'Not found', status: 404, code: 'not_found' } as never),
    } as never);
    await show(<SessionScreen />);
    expect(screen.getByText(/isn’t here any more/)).toBeTruthy();
  });
});

describe('Edit session', () => {
  it('edits a workout in the workout editor and keeps its time', async () => {
    jest.mocked(putSession).mockResolvedValue({ status: 200, data: { session: WORKOUT, new_records: [] } } as never);
    await show(<EditSessionScreen />);
    const weight = await screen.findByLabelText('Bench press, Set 1, weight in kg');
    expect(weight.props.value).toBe('62.5');
    await act(() => fireEvent.changeText(screen.getByLabelText('Bench press, Set 2, reps'), ''));
    await press('Save changes');
    expect(screen.getByText('Some sets need their reps or weight.')).toBeTruthy();
    expect(putSession).not.toHaveBeenCalled();
    await act(() => fireEvent.changeText(screen.getByLabelText('Bench press, Set 2, reps'), '9'));
    await act(() => fireEvent.changeText(weight, '65'));
    await act(() => fireEvent.changeText(screen.getByLabelText('Session name'), 'Upper body B'));
    await press('Save changes');
    const [id, body] = jest.mocked(putSession).mock.calls[0];
    expect(id).toBe('s1');
    expect(body).toMatchObject({ name: 'Upper body B', started_at: WORKOUT.started_at, local_date: WORKOUT.local_date, duration_s: 2892, note: 'Felt strong on the last set.' });
    expect(body.strength?.exercises[0].sets).toEqual([
      { position: 0, weight_kg: 40, reps: 10, kind: 'warmup' },
      { position: 1, weight_kg: 65, reps: 8, kind: 'working' },
      { position: 2, weight_kg: 60, reps: 9, kind: 'working' },
    ]);
    expect(body.strength?.exercises.map((entry) => entry.superset_group)).toEqual([null, null, 1, 1]);
    expect(router.dismissTo).toHaveBeenCalledWith('/history/s1');
    expect(screen.getByText('Changes saved.')).toBeTruthy();
  });

  it('edits a run in its quick log form', async () => {
    mockId = 'r1';
    jest.mocked(putSession).mockResolvedValue({ status: 200, data: { session: RUN, new_records: [] } } as never);
    await show(<EditSessionScreen />);
    expect(screen.getByLabelText('Duration').props.value).toBe('32:00');
    await act(() => fireEvent.changeText(screen.getByLabelText('Distance · km'), '6.4'));
    await press('Save changes');
    expect(jest.mocked(putSession).mock.calls[0]).toEqual([
      'r1',
      expect.objectContaining({ tracker_id: 'run', duration_s: 1920, cardio: { distance_m: 6400 }, started_at: RUN.started_at, local_date: RUN.local_date, name: null }),
    ]);
  });

  it('shows why the server refused the change', async () => {
    mockId = 'r1';
    jest.mocked(putSession).mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Not found', status: 404, code: 'not_found' } as never));
    await show(<EditSessionScreen />);
    await press('Save changes');
    expect(await screen.findByText('This session was deleted, so the changes can’t be saved.')).toBeTruthy();
  });

  it('cannot save offline', async () => {
    mockId = 'r1';
    useConnection.setState({ online: false });
    await show(<EditSessionScreen />);
    expect(screen.getByText('You’re offline. Editing needs a connection.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save changes', disabled: true })).toBeTruthy();
  });
});
