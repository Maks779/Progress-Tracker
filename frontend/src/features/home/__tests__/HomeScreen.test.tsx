import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { usePreferences } from '@/features/settings/preferences';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { useHome } from '@/shared/api/generated/endpoints/stats/stats';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { GoalOut, HomeStats, SessionListItem, TrackerSummary } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { HomeScreen } from '../HomeScreen';

jest.mock('@/shared/api/generated/endpoints/stats/stats', () => ({ useHome: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/goals/goals', () => ({ useListGoals: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ useReadMe: jest.fn() }));

const mockEntry = { available: true, active: false, starting: false, open: jest.fn() };
jest.mock('@/features/workout/start', () => ({ useWorkoutEntry: () => mockEntry }));

const mockNavigate = jest.fn();
let mockPathname = '/';
jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn(), push: jest.fn() },
  usePathname: () => mockPathname,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

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

function tracker(overrides: Partial<TrackerSummary>): TrackerSummary {
  return {
    id: 'gym',
    type: 'strength',
    name: 'Gym',
    description: null,
    color: 'strength',
    icon: 'dumbbell',
    general_mode: null,
    counter_unit: null,
    counter_unit_note: null,
    position: 0,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    session_count: 0,
    archived: false,
    ...overrides,
  };
}

function goal(overrides: Partial<GoalOut>, value: number, target: number): GoalOut {
  return {
    id: 'gym-weekly',
    tracker_id: 'gym',
    kind: 'frequency',
    period: 'week',
    metric: 'sessions',
    name: null,
    start_date: '2026-11-01',
    end_date: null,
    is_pinned: true,
    target,
    progress: { period_start: '2026-11-23', period_end: '2026-11-29', value, target, expected: null, status: 'on_track' },
    streak_weeks: 4,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

const today = toIsoDate(new Date());
const GYM = tracker({});
const BOOKS = tracker({ id: 'books', type: 'reading', name: 'Reading', color: 'reading', icon: 'book-open', position: 1 });
const GYM_WEEKLY = goal({}, 2, 3);
const BOOKS_WEEKLY = goal({ id: 'books-weekly', tracker_id: 'books', kind: 'amount', metric: 'pages', streak_weeks: 0 }, 48, 60);

function session(overrides: Partial<SessionListItem>): SessionListItem {
  return {
    id: 'lift',
    tracker_id: 'gym',
    tracker_type: 'strength',
    name: 'Upper body A',
    started_at: `${today}T08:00:00Z`,
    local_date: today,
    duration_s: 2880,
    headline: { metric: 'volume_kg', value: 4820 },
    ...overrides,
  };
}

const STATS: HomeStats = {
  week_start: '2026-11-23',
  main_tracker_id: 'gym',
  pinned_goal: GYM_WEEKLY,
  active_time_s: 5760,
  volume_kg: 9240,
  pages_read: 48,
  recent_sessions: [
    session({}),
    session({ id: 'read', tracker_id: 'books', tracker_type: 'reading', name: 'Atomic Habits', duration_s: 1200, headline: { metric: 'pages', value: 24 } }),
  ],
  up_next: null,
  week_days: [
    { local_date: '2026-11-24', tracker_ids: ['gym'] },
    { local_date: '2026-11-25', tracker_ids: ['books'] },
    { local_date: '2026-11-27', tracker_ids: ['gym'] },
  ],
};

const refetch = { home: jest.fn(), trackers: jest.fn(), goals: jest.fn() };

function serve({
  stats = STATS,
  trackers = [GYM, BOOKS],
  goals = [GYM_WEEKLY, BOOKS_WEEKLY],
  pending = false,
  failed = false,
}: { stats?: HomeStats; trackers?: TrackerSummary[]; goals?: GoalOut[]; pending?: boolean; failed?: boolean } = {}) {
  const result = (data: unknown, retry: jest.Mock) => ({
    isPending: pending,
    data: pending ? undefined : failed ? { status: 500, data: {} } : { status: 200, data },
    refetch: retry,
  });
  (useHome as jest.Mock).mockReturnValue(result(stats, refetch.home));
  (useListTrackers as jest.Mock).mockReturnValue(result({ items: trackers }, refetch.trackers));
  (useListGoals as jest.Mock).mockReturnValue(result({ items: goals }, refetch.goals));
}

async function open() {
  await render(
    <ThemeProvider>
      <HomeScreen />
    </ThemeProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockEntry, { available: true, active: false, starting: false });
  mockWidth = 390;
  mockPathname = '/';
  usePreferences.setState((state) => ({ values: { ...state.values, weight_unit: 'kg', distance_unit: 'km' } }));
  (useReadMe as jest.Mock).mockReturnValue({ data: { status: 200, data: { name: 'Alex Morgan' } } });
  serve();
});

describe('Home', () => {
  it('greets by first name and shows the week of the main tracker on a phone', async () => {
    await open();

    expect(screen.getByText('Let’s keep moving, Alex.')).toBeTruthy();
    expect(screen.getByLabelText('2 of 3 workouts this week')).toBeTruthy();
    expect(screen.getByText('One more.\nYou’ve got this.')).toBeTruthy();
    expect(screen.getByText('4-week streak')).toBeTruthy();
    expect(screen.getByLabelText('Upper body A, Today · 48 min, 4,820 kg')).toBeTruthy();
    expect(screen.getByLabelText('Atomic Habits, Today · 20 min, 24 pages')).toBeTruthy();
    expect(screen.getByText('12 pages to your next goal')).toBeTruthy();
    expect(screen.getByText('Reading · 48 / 60 pages this week')).toBeTruthy();
    expect(screen.queryByText('Active time')).toBeNull();
    expect(screen.queryByText('Your weekly rhythm')).toBeNull();
    expect(screen.queryByText('Up next')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    expect(mockEntry.open).toHaveBeenCalled();
  });

  it('opens a recent session, and all of them, in History', async () => {
    await open();
    await fireEvent.press(screen.getByRole('link', { name: 'Atomic Habits, Today · 20 min, 24 pages' }));
    expect(mockNavigate).toHaveBeenCalledWith('history');
    expect(router.dismissTo).toHaveBeenCalledWith('/history');
    expect(router.push).toHaveBeenCalledWith('/history/read', { withAnchor: true });
    jest.mocked(router.push).mockClear();
    await fireEvent.press(screen.getByRole('link', { name: 'See all' }));
    expect(router.push).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenLastCalledWith('/history');
  });

  it('offers to resume the workout under way', async () => {
    mockEntry.active = true;
    await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Resume workout' }));
    expect(mockEntry.open).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
  });

  it('shows the workout up next beside Home on wide screens, until one is under way', async () => {
    mockWidth = 1440;
    const upNext = { session_id: 'last', name: 'Lower body A', exercise_count: 4, estimated_duration_s: 2700 };
    serve({ stats: { ...STATS, up_next: upNext } });
    await open();

    expect(screen.getByText('Up next')).toBeTruthy();
    expect(screen.getByText('Lower body A')).toBeTruthy();
    expect(screen.getByText(/4 exercises · around 45 min/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview workout' })).toBeTruthy();

    mockEntry.active = true;
    await open();
    expect(screen.queryByText('Up next')).toBeNull();
  });

  it('adds the week’s totals and rhythm on tablets and desktop', async () => {
    mockWidth = 1440;
    await open();

    expect(screen.getByLabelText('Active time: 96 minutes this week')).toBeTruthy();
    expect(screen.getByLabelText('Training volume: 9,240 kg this week')).toBeTruthy();
    expect(screen.getByLabelText('Pages read: 48 of 60 this week')).toBeTruthy();
    expect(screen.getByText('Your weekly rhythm')).toBeTruthy();
    expect(screen.getByLabelText('Days with sessions this week: Tuesday, Friday')).toBeTruthy();
  });

  it('shows the totals in pounds and leaves out what the trackers do not measure', async () => {
    mockWidth = 768;
    usePreferences.setState((state) => ({ values: { ...state.values, weight_unit: 'lb' } }));
    serve({ trackers: [GYM], goals: [GYM_WEEKLY] });
    await open();

    expect(screen.getByLabelText('Training volume: 20,371 lb this week')).toBeTruthy();
    expect(screen.queryByText('Pages read')).toBeNull();
    expect(screen.queryByText(/to your next goal/)).toBeNull();
  });

  it('shows a skeleton while loading', async () => {
    serve({ pending: true });
    await open();

    expect(screen.getByLabelText('Loading your progress…')).toBeTruthy();
  });

  it('explains a failed load and retries every request', async () => {
    serve({ failed: true });
    await open();

    expect(screen.getByText('Couldn’t load home.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch.home).toHaveBeenCalled();
    expect(refetch.trackers).toHaveBeenCalled();
    expect(refetch.goals).toHaveBeenCalled();
  });

  it('invites to set a weekly goal and opens the form for the main tracker from Home', async () => {
    serve({ goals: [BOOKS_WEEKLY] });
    await open();

    expect(screen.getByText('Your ring is waiting.')).toBeTruthy();
    expect(screen.getByText('A weekly goal for Gym fills this ring and starts your streak.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Set a weekly goal' }));
    expect(mockNavigate).toHaveBeenCalledWith('profile');
    expect(router.dismissTo).toHaveBeenCalledWith('/profile');
    expect(router.push).toHaveBeenCalledWith('/profile/goals/new?tracker=gym&from=home', { withAnchor: true });
  });

  it('follows another tracker’s weekly goal without a main tracker', async () => {
    mockEntry.available = false;
    serve({ stats: { ...STATS, main_tracker_id: null }, trackers: [BOOKS], goals: [BOOKS_WEEKLY] });
    await open();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();

    expect(screen.getByLabelText('48 of 60 pages this week')).toBeTruthy();
    expect(screen.getByText('You’re on your way.')).toBeTruthy();
  });

  it('says when the goal is met and when nothing was logged yet', async () => {
    serve({ goals: [goal({}, 3, 3)], stats: { ...STATS, recent_sessions: [] } });
    await open();

    expect(screen.getByText('Goal met.\nNice work.')).toBeTruthy();
    expect(screen.getByText('Your sessions will appear here.')).toBeTruthy();
  });

  it('shows the empty state when every tracker is archived', async () => {
    serve({ trackers: [{ ...GYM, archived: true }] });
    await open();

    expect(screen.getByText('Your first week starts now.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Create your first tracker' }));
    expect(router.push).toHaveBeenCalledWith('/profile/trackers/new', { withAnchor: true });
  });

  it('uses the plain title until the account is loaded', async () => {
    (useReadMe as jest.Mock).mockReturnValue({ data: undefined });
    await open();

    expect(screen.getByText('Let’s keep moving.')).toBeTruthy();
  });
});
