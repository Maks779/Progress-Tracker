import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { useOutbox } from '@/features/outbox/outbox';
import { usePreferences } from '@/features/settings/preferences';
import { useConnection } from '@/shared/api/connection';
import { putBook, useListBooks } from '@/shared/api/generated/endpoints/books/books';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { listSessions, putSession, useGetSession, useListSessions } from '@/shared/api/generated/endpoints/sessions/sessions';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { BookOut, GoalOut, SessionOut, TrackerSummary } from '@/shared/api/generated/model';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';
import { ToastHost } from '@/shared/ui/Toast';

import { openChooser, useChooser } from '../chooser';
import { QuickActions } from '../components/QuickActions';
import { TrackerChooser } from '../components/TrackerChooser';
import { QuickLogScreen } from '../screens/QuickLogScreen';

let mockTracker = 'read';
const mockOpenWorkout = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), dismissTo: jest.fn(), setParams: jest.fn(), replace: jest.fn(), back: jest.fn() },
  usePathname: () => '/',
  useLocalSearchParams: () => ({ tracker: mockTracker }),
}));
jest.mock('@/features/workout/start', () => ({
  useWorkoutEntry: () => ({ available: true, active: false, starting: false, open: mockOpenWorkout }),
}));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ useReadMe: () => ({ data: { status: 200, data: { id: 'me' } } }) }));
jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/goals/goals', () => ({ useListGoals: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/books/books', () => ({
  useListBooks: jest.fn(),
  putBook: jest.fn(),
  getListBooksQueryKey: () => ['/api/v1/books'],
}));
jest.mock('@/shared/api/generated/endpoints/sessions/sessions', () => ({
  useListSessions: jest.fn(),
  useGetSession: jest.fn(),
  putSession: jest.fn(),
  listSessions: jest.fn(),
  getListSessionsQueryKey: (params: unknown) => ['/api/v1/sessions', params],
  getGetSessionQueryKey: (id: string) => [`/api/v1/sessions/${id}`],
}));
jest.mock('@/shared/api/generated/endpoints/exercises/exercises', () => ({ putExercise: jest.fn() }));

function tracker(id: string, overrides: Partial<TrackerSummary>): TrackerSummary {
  return {
    id,
    name: id,
    type: 'general',
    general_mode: null,
    counter_unit: null,
    counter_unit_note: null,
    color: 'general',
    icon: 'sparkles',
    position: 0,
    archived: false,
    ...overrides,
  } as TrackerSummary;
}

const TRACKERS = [
  tracker('gym', { name: 'Gym', type: 'strength', color: 'strength', icon: 'dumbbell', position: 0 }),
  tracker('run', { name: 'Running', type: 'cardio', color: 'cardio', icon: 'activity', position: 1 }),
  tracker('read', { name: 'Reading', type: 'reading', color: 'reading', icon: 'book-open', position: 2 }),
  tracker('calm', { name: 'Meditation', general_mode: 'duration', position: 3 }),
  tracker('water', { name: 'Water', general_mode: 'counter', counter_unit: 'glasses', counter_unit_note: '250 ml each', position: 4 }),
];
const BOOK = {
  id: 'habits',
  title: 'Atomic Habits',
  author: 'James Clear',
  total_pages: 320,
  start_page: 0,
  current_page: 144,
  progress_percent: 45,
  finished_date: null,
  estimated_finish_date: '2026-12-15',
} as BookOut;
const LAST: Record<string, Partial<SessionOut>> = {
  read: { id: 'last-read', duration_s: 1200, reading: { book_id: 'habits', end_page: 144 }, stats: { pages_read: 24 } as SessionOut['stats'] },
  run: { id: 'last-run', duration_s: 1920, cardio: { distance_m: 5200 }, stats: {} as SessionOut['stats'] },
  calm: { id: 'last-calm', duration_s: 600, stats: {} as SessionOut['stats'] },
  water: { id: 'last-water', general: { count: 6 }, stats: {} as SessionOut['stats'] },
};

let client: QueryClient;

function serve({ books = [BOOK], goals = [] as GoalOut[] } = {}) {
  jest.mocked(useListTrackers).mockReturnValue({ isPending: false, data: { status: 200, data: { items: TRACKERS } } } as never);
  jest.mocked(useListGoals).mockReturnValue({ data: { status: 200, data: { items: goals } } } as never);
  jest.mocked(useListBooks).mockReturnValue({ isError: false, data: { status: 200, data: { items: books } } } as never);
  jest.mocked(useListSessions).mockImplementation((params) => {
    const last = LAST[(params as { tracker_id: string }).tracker_id];
    return { isError: false, data: { status: 200, data: { items: last ? [{ id: last.id }] : [] } } } as never;
  });
  jest.mocked(useGetSession).mockImplementation((id) => {
    const last = Object.values(LAST).find((item) => item.id === id);
    return { isError: false, data: last ? { status: 200, data: last } : undefined } as never;
  });
}

function tree(element: ReactElement) {
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        {element}
        <ToastHost />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

async function show(element: ReactElement) {
  await render(tree(element));
}

const press = (name: string) => act(() => fireEvent.press(screen.getByRole('button', { name })));
const type = (label: string, value: string) => act(() => fireEvent.changeText(screen.getByLabelText(label), value));
const saved = (body: unknown) =>
  ({
    status: 201,
    data: { session: { id: 's', tracker_id: (body as { tracker_id: string }).tracker_id }, new_records: [], goals: [], ...(body as object) },
    headers: new Headers(),
  }) as never;

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  client = new QueryClient();
  mockTracker = 'read';
  useAuthStore.setState({ status: 'signedIn' });
  useConnection.setState({ online: true, reachable: true });
  useOutbox.setState({ hydrated: true, items: [], syncing: false, retryAt: null });
  usePreferences.setState((current) => ({ values: { ...current.values, distance_unit: 'km' } }));
  jest.mocked(putSession).mockImplementation(async (_id, body) => saved(body));
  jest.mocked(listSessions).mockResolvedValue({ status: 200, data: { items: [{ id: 's' }], next_cursor: null } } as never);
  serve();
});

afterEach(() => {
  client.clear();
});

describe('Log reading', () => {
  it('starts from the book’s page with last time’s pages and minutes, keeps the fields in step and saves', async () => {
    await show(<QuickLogScreen />);

    expect(screen.getByText('Log reading')).toBeTruthy();
    expect(screen.getByLabelText('Pages read').props.value).toBe('24');
    expect(screen.getByLabelText('Current page').props.value).toBe('168');
    expect(screen.getByLabelText('Minutes · optional').props.value).toBe('20');
    expect(screen.getByText('Last session ended on page 144.')).toBeTruthy();
    expect(screen.getByText('144 / 320 pages · 45%')).toBeTruthy();

    await type('Pages read', '30');
    expect(screen.getByLabelText('Current page').props.value).toBe('174');
    await type('Current page', '200');
    expect(screen.getByLabelText('Pages read').props.value).toBe('56');

    await press('Save reading');
    const [, body] = jest.mocked(putSession).mock.calls[0];
    expect(body).toMatchObject({ tracker_id: 'read', duration_s: 1200, reading: { book_id: 'habits', end_page: 200 } });
    expect(screen.getByText('Reading saved. Nice work.')).toBeTruthy();
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('refuses pages before the last one or past the end, and sends nothing', async () => {
    await show(<QuickLogScreen />);
    await type('Current page', '100');
    await press('Save reading');
    expect(screen.getByText('Read past page 144 to log it.')).toBeTruthy();
    await type('Current page', '321');
    expect(screen.getByText('This book has 320 pages.')).toBeTruthy();
    expect(putSession).not.toHaveBeenCalled();
  });

  it('adds the first book, then logs from its start page', async () => {
    serve({ books: [] });
    jest.mocked(putBook).mockImplementation(async (id, body) => ({ status: 201, data: { ...BOOK, ...body, id, current_page: 10, start_page: 10 } }) as never);
    await show(<QuickLogScreen />);

    expect(screen.getByText('No books yet. Add the one you’re reading.')).toBeTruthy();
    await press('Add a book');
    await type('Title', 'First Book');
    await type('Total pages', '0');
    await press('Save book');
    expect(screen.getByText('Between 1 and 10,000 pages.')).toBeTruthy();
    await type('Total pages', '100');
    await type('Start page', '10');
    await press('Save book');

    expect(jest.mocked(putBook).mock.calls[0][1]).toEqual({ title: 'First Book', author: null, total_pages: 100, start_page: 10 });
    expect(screen.getByRole('button', { name: 'Book: First Book' })).toBeTruthy();
    expect(screen.getByText('You start from page 10.')).toBeTruthy();
  });

  it('keeps what was typed when a newer last session turns up, and remembers the one it saved', async () => {
    await show(<QuickLogScreen />);
    await type('Pages read', '30');
    jest.mocked(useListSessions).mockReturnValue({ isError: false, data: { status: 200, data: { items: [{ id: 'newer' }] } } } as never);
    jest.mocked(useGetSession).mockReturnValue({ isError: false, data: undefined } as never);
    await screen.rerender(tree(<QuickLogScreen />));

    expect(screen.getByLabelText('Pages read').props.value).toBe('30');
    await press('Save reading');
    expect(client.getQueryData(['/api/v1/sessions/s'])).toMatchObject({ status: 200, data: { id: 's', tracker_id: 'read' } });
    expect(listSessions).toHaveBeenCalledWith({ tracker_id: 'read', limit: 1 });
  });

  it('says so when the session waits on the device', async () => {
    useConnection.setState({ online: false });
    await show(<QuickLogScreen />);
    await press('Save reading');
    expect(putSession).not.toHaveBeenCalled();
    expect(useOutbox.getState().items).toEqual([expect.objectContaining({ kind: 'session', userId: 'me' })]);
    expect(screen.getByText('Saved on this device. It syncs when you’re back online.')).toBeTruthy();
  });
});

describe('Log cardio, minutes and counts', () => {
  it('repeats the last run, reads typed minutes and shows the pace', async () => {
    mockTracker = 'run';
    serve({ goals: [{ id: 'g', tracker_id: 'run', kind: 'amount', period: 'week', metric: 'distance', is_pinned: true, target: 12000, progress: { value: 5200, target: 12000 } } as GoalOut] });
    await show(<QuickLogScreen />);

    expect(screen.getByText('Log cardio')).toBeTruthy();
    expect(screen.getByLabelText('Duration').props.value).toBe('32:00');
    expect(screen.getByLabelText('Distance · km').props.value).toBe('5.2');
    expect(screen.getByText('Pace 6:09 / km')).toBeTruthy();
    expect(screen.getByText('5.2 / 12 km this week')).toBeTruthy();

    await type('Duration', '');
    await press('Save activity');
    expect(screen.getByText('Enter how long it took.')).toBeTruthy();
    await type('Duration', '45');
    await act(() => fireEvent(screen.getByLabelText('Duration'), 'blur'));
    expect(screen.getByLabelText('Duration').props.value).toBe('45:00');
    await type('Distance · km', '7,5');
    await press('Save activity');
    expect(jest.mocked(putSession).mock.calls[0][1]).toMatchObject({ duration_s: 2700, cardio: { distance_m: 7500 } });
  });

  it('switches the form when another tracker is chosen', async () => {
    mockTracker = 'run';
    await show(<QuickLogScreen />);
    await press('Tracker: Running');
    await act(() => fireEvent.press(screen.getByRole('radio', { name: 'Meditation' })));
    expect(router.setParams).toHaveBeenCalledWith({ tracker: 'calm' });
  });

  it('logs minutes and counts with their limits', async () => {
    mockTracker = 'calm';
    await show(<QuickLogScreen />);
    expect(screen.getByText('Log Meditation')).toBeTruthy();
    await type('Duration · minutes', '1441');
    await press('Save session');
    expect(screen.getByText('At most 1,440 minutes.')).toBeTruthy();
    await type('Duration · minutes', '15');
    await press('Save session');
    expect(jest.mocked(putSession).mock.calls[0][1]).toMatchObject({ tracker_id: 'calm', duration_s: 900 });
  });

  it('saves the moment of saving when the form was left open, not when it was opened', async () => {
    mockTracker = 'water';
    jest.useFakeTimers({ now: new Date(2026, 10, 27, 23, 50), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      await show(<QuickLogScreen />);
      expect(screen.getByRole('button', { name: /^When: Today, November 27/ })).toBeTruthy();
      await act(async () => {
        jest.setSystemTime(new Date(2026, 10, 28, 0, 10));
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getByRole('button', { name: /^When: Today, November 28/ })).toBeTruthy();
      await press('Save session');
      expect(jest.mocked(putSession).mock.calls[0][1]).toMatchObject({
        local_date: '2026-11-28',
        started_at: new Date(2026, 10, 28, 0, 10, 30).toISOString(),
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts glasses from last time', async () => {
    mockTracker = 'water';
    await show(<QuickLogScreen />);
    expect(screen.getByText('glasses · 250 ml each')).toBeTruthy();
    await press('More glasses');
    await press('Save session');
    expect(jest.mocked(putSession).mock.calls[0][1]).toMatchObject({ tracker_id: 'water', general: { count: 7 } });
  });

  it('has nothing to log for a strength tracker or one that is gone', async () => {
    mockTracker = 'gym';
    await show(<QuickLogScreen />);
    expect(screen.getByText('Workouts are logged with Start workout.')).toBeTruthy();
    mockTracker = 'nope';
    await show(<QuickLogScreen />);
    expect(screen.getByText(/This tracker isn’t here any more/)).toBeTruthy();
  });
});

describe('Log a session', () => {
  it('lists every active tracker: a workout for strength, a quick log for the others', async () => {
    const showTab = jest.fn();
    await show(<TrackerChooser />);
    await act(() => openChooser(showTab));

    expect(screen.getByText('Log a session')).toBeTruthy();
    await act(() => fireEvent.press(screen.getByRole('link', { name: 'Running, Cardio · Quick log' })));
    expect(router.push).toHaveBeenCalledWith('/quick-log/run', { withAnchor: true });
    expect(useChooser.getState().open).toBe(false);

    await act(() => openChooser(showTab));
    await act(() => fireEvent.press(screen.getByRole('link', { name: 'Gym, Start workout' })));
    expect(mockOpenWorkout).toHaveBeenCalledWith('gym');
  });
});

describe('Home’s quick actions', () => {
  it('offer Log reading and Other, or one button without a reading tracker, or none for strength only', async () => {
    const showTab = jest.fn();
    await show(<QuickActions trackers={TRACKERS} showTab={showTab} />);
    await press('Log reading');
    expect(router.push).toHaveBeenCalledWith('/quick-log/read', { withAnchor: true });
    await press('Other');
    expect(useChooser.getState().open).toBe(true);

    await show(<QuickActions trackers={TRACKERS.filter((item) => item.type !== 'reading')} showTab={showTab} />);
    expect(screen.getByRole('button', { name: 'Log a session' })).toBeTruthy();
    await show(<QuickActions trackers={[TRACKERS[0]]} showTab={showTab} />);
    expect(screen.queryByRole('button', { name: 'Log a session' })).toBeNull();
  });
});
