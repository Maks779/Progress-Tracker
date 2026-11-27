import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { useOutbox } from '@/features/outbox/outbox';
import { usePreferences } from '@/features/settings/preferences';
import { useConnection } from '@/shared/api/connection';
import { listRecords, useExerciseProgress, useListExercises } from '@/shared/api/generated/endpoints/exercises/exercises';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useListSessions } from '@/shared/api/generated/endpoints/sessions/sessions';
import { useProgress } from '@/shared/api/generated/endpoints/stats/stats';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { ExerciseOut, GoalOut, ProgressStats, RecordOut, TrackerSummary } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { ProgressScreen } from '../screens/ProgressScreen';
import { RecordsScreen } from '../screens/RecordsScreen';

const mockNavigate = jest.fn();
const mockEntry = { available: true, active: false, starting: false, open: jest.fn() };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), dismissTo: jest.fn() },
  usePathname: () => '/progress/records',
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/features/workout/start', () => ({ useWorkoutEntry: () => mockEntry }));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ useReadMe: () => ({ data: { status: 200, data: { id: 'me' } } }) }));
jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/goals/goals', () => ({ useListGoals: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/sessions/sessions', () => ({ useListSessions: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/stats/stats', () => ({ useProgress: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/exercises/exercises', () => ({
  useListExercises: jest.fn(),
  useExerciseProgress: jest.fn(),
  listRecords: jest.fn(),
  getListRecordsQueryKey: (params: unknown) => ['/api/v1/records', params],
}));

const today = toIsoDate(new Date());
const TRACKERS = [
  { id: 'gym', name: 'Gym', type: 'strength', position: 0, archived: false, color: 'strength', icon: 'dumbbell' },
  { id: 'read', name: 'Reading', type: 'reading', position: 1, archived: false, color: 'reading', icon: 'book-open' },
] as TrackerSummary[];
const CATALOG = [
  { id: 'bench', key: 'bench_press', name: null, is_custom: false, last_used_date: '2026-11-26' },
  { id: 'squat', key: 'squat', name: null, is_custom: false, last_used_date: '2026-11-20' },
  { id: 'curl', key: 'cable_curl', name: null, is_custom: false, last_used_date: null },
] as ExerciseOut[];
const STATS = {
  period: '4w',
  bucket: 'week',
  volume_kg: [
    { start_date: '2026-11-02', value: 6000 },
    { start_date: '2026-11-09', value: 8000 },
    { start_date: '2026-11-16', value: 7000 },
    { start_date: '2026-11-23', value: 11_480 },
  ],
  pages: [
    { start_date: '2026-11-02', value: 24 },
    { start_date: '2026-11-09', value: 42 },
    { start_date: '2026-11-16', value: 36 },
    { start_date: '2026-11-23', value: 60 },
  ],
  consistency: { active_days: 3, days: [today] },
  totals: { volume_kg: 32_480, volume_change_percent: 18, pages_read: 162, books_read: 2 },
} as ProgressStats;
const GOAL = { id: 'g', tracker_id: 'gym', kind: 'frequency', period: 'week', is_pinned: true, streak_weeks: 4 } as GoalOut;

let client: QueryClient;

function serve({ sessions = 5 } = {}) {
  jest.mocked(useListTrackers).mockReturnValue({ isPending: false, data: { status: 200, data: { items: TRACKERS } } } as never);
  jest.mocked(useListGoals).mockReturnValue({ data: { status: 200, data: { items: [GOAL] } } } as never);
  jest.mocked(useListSessions).mockReturnValue({ data: { status: 200, data: { items: Array.from({ length: Math.min(sessions, 2) }, (_, index) => ({ id: `s${index}` })) } } } as never);
  jest.mocked(useListExercises).mockReturnValue({ isPending: false, data: { status: 200, data: { items: CATALOG } } } as never);
  jest.mocked(useProgress).mockReturnValue({ isError: false, data: { status: 200, data: STATS } } as never);
  jest.mocked(useExerciseProgress).mockImplementation(
    (id) =>
      ({
        isPending: false,
        data: {
          status: 200,
          data: {
            exercise_id: id,
            period: '4w',
            change_kg: id === 'bench' ? 7.5 : null,
            points:
              id === 'bench'
                ? [
                    { session_id: 'a', local_date: '2026-11-05', weight_kg: 55 },
                    { session_id: 'b', local_date: '2026-11-26', weight_kg: 62.5 },
                  ]
                : [{ session_id: 'c', local_date: '2026-11-20', weight_kg: 90 }],
          },
        },
      }) as never,
  );
}

async function show(element: ReactElement) {
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{element}</ThemeProvider>
    </QueryClientProvider>,
  );
}

const press = (name: string | RegExp, role: 'button' | 'radio' | 'link' = 'button') => act(() => fireEvent.press(screen.getByRole(role, { name })));

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  client = new QueryClient();
  useAuthStore.setState({ status: 'signedIn' });
  useConnection.setState({ online: true, reachable: true });
  useOutbox.setState({ hydrated: true, items: [], syncing: false, retryAt: null });
  usePreferences.setState((current) => ({ values: { ...current.values, weight_unit: 'kg', distance_unit: 'km' } }));
  serve();
});

afterEach(() => {
  client.clear();
});

describe('Progress', () => {
  it('shows the line of the exercise done last, volume and pages by week, consistency and totals', async () => {
    await show(<ProgressScreen />);
    expect(screen.getByRole('button', { name: 'Bench press, choose another exercise' })).toBeTruthy();
    expect(screen.getByText('62.5')).toBeTruthy();
    expect(screen.getByText('+7.5 kg in 4 weeks')).toBeTruthy();
    expect(screen.getByText('Volume · kg')).toBeTruthy();
    expect(screen.getByLabelText('Volume · kg: Nov 2 6,000 kg, Nov 9 8,000 kg, Nov 16 7,000 kg, Nov 23 11,480 kg')).toBeTruthy();
    expect(screen.getByText('11.5k', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Pages / week')).toBeTruthy();
    expect(screen.getByText('Consistency, in weeks.')).toBeTruthy();
    expect(screen.getByText(/· 3 active days$/)).toBeTruthy();
    expect(screen.getByText('4 consecutive weeks of meeting your goal. Rest days never break your streak.')).toBeTruthy();
    expect(screen.getByLabelText('Training volume · last 4 weeks: 32,480, kg · +18% vs previous period')).toBeTruthy();
    expect(screen.getByLabelText('Pages read · last 4 weeks: 162, pages · 2 books finished')).toBeTruthy();
  });

  it('follows the period, the exercise and the tracker chosen', async () => {
    await show(<ProgressScreen />);
    await press('3M', 'radio');
    expect(useProgress).toHaveBeenLastCalledWith({ period: '3m', tracker_id: undefined }, expect.anything());
    expect(useExerciseProgress).toHaveBeenLastCalledWith('bench', { period: '3m' }, expect.anything());
    await press('Bench press, choose another exercise');
    expect(screen.queryByRole('radio', { name: 'Cable curl' })).toBeNull();
    await press('Squat', 'radio');
    expect(useExerciseProgress).toHaveBeenLastCalledWith('squat', { period: '3m' }, expect.anything());
    expect(screen.getByText('One session so far. The line starts with the next one.')).toBeTruthy();
    await press('Filter by tracker');
    await press('Reading', 'radio');
    expect(useProgress).toHaveBeenLastCalledWith({ period: '3m', tracker_id: 'read' }, expect.anything());
    expect(screen.queryByText('Volume · kg')).toBeNull();
    expect(screen.queryByRole('button', { name: /choose another exercise/ })).toBeNull();
    expect(screen.getByText('Pages / week')).toBeTruthy();
  });

  it('invites a second session first', async () => {
    serve({ sessions: 1 });
    await show(<ProgressScreen />);
    expect(screen.getByText('A baseline is a beginning.')).toBeTruthy();
    await press('Start a workout');
    expect(mockEntry.open).toHaveBeenCalled();
  });

  it('says so when it cannot load', async () => {
    jest.mocked(useProgress).mockReturnValue({ isError: true, data: undefined, refetch: jest.fn() } as never);
    await show(<ProgressScreen />);
    expect(screen.getByText('Couldn’t load progress.')).toBeTruthy();
  });

  it('opens Records', async () => {
    await show(<ProgressScreen />);
    await press('Records', 'radio');
    expect(router.push).toHaveBeenCalledWith('/progress/records');
  });
});

describe('Records', () => {
  const record = (record_type: RecordOut['record_type'], value: number, weight_kg: number | null, reps: number, exercise_id = 'bench'): RecordOut =>
    ({ exercise_id, record_type, value, weight_kg, reps, session_id: `session-${exercise_id}`, local_date: '2026-10-25' }) as RecordOut;

  it('lists every best, each opening its session in History', async () => {
    jest.mocked(listRecords).mockResolvedValue({
      status: 200,
      data: {
        items: [record('max_weight', 62.5, 62.5, 8), record('max_reps', 10, 60, 10), record('estimated_1rm', 83.33, 62.5, 10), record('max_weight', 90, 90, 5, 'squat')],
        new_this_week: 3,
        next_cursor: null,
      },
    } as never);
    await show(<RecordsScreen />);
    expect(await screen.findByRole('link', { name: 'Bench press · Max weight, 62.5 kg, Oct 25, 2026 · 8 reps' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bench press · Max reps, 10 reps, Oct 25, 2026 · 60 kg' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bench press · Est. 1RM, 83.3 kg, Oct 25, 2026 · Epley estimate' })).toBeTruthy();
    expect(screen.getByText('3 new records this week')).toBeTruthy();
    await press(/^Squat · Max weight/, 'link');
    expect(mockNavigate).toHaveBeenCalledWith('history');
    expect(router.dismissTo).toHaveBeenCalledWith('/history');
    expect(router.push).toHaveBeenCalledWith('/history/session-squat', { withAnchor: true });
  });

  it('says when there is none yet', async () => {
    jest.mocked(listRecords).mockResolvedValue({ status: 200, data: { items: [], new_this_week: 0, next_cursor: null } } as never);
    await show(<RecordsScreen />);
    expect(await screen.findByText('No records yet. They come with the second workout of an exercise.')).toBeTruthy();
    expect(screen.queryByText(/new record/)).toBeNull();
  });
});
