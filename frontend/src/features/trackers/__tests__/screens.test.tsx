import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ApiError } from '@/shared/api/fetcher';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { updateMe, useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { createTracker, deleteTracker, updateTracker, useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { NewTrackerScreen } from '../screens/NewTrackerScreen';
import { TrackerScreen } from '../screens/TrackerScreen';
import { TrackersScreen } from '../screens/TrackersScreen';

jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({
  useListTrackers: jest.fn(),
  createTracker: jest.fn(),
  updateTracker: jest.fn(),
  deleteTracker: jest.fn(),
}));
jest.mock('@/shared/api/generated/endpoints/goals/goals', () => ({ useListGoals: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({
  useReadMe: jest.fn(),
  updateMe: jest.fn(),
  getReadMeQueryKey: () => ['/api/v1/me'],
}));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Link: ({ children }: { children: unknown }) => children,
}));

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

const GYM = tracker({ session_count: 18 });
const WATER = tracker({
  id: 'water',
  type: 'general',
  name: 'Water',
  color: 'general',
  icon: 'droplet',
  general_mode: 'counter',
  counter_unit: 'glasses',
  position: 1,
  session_count: 1,
});
const OLD = tracker({ id: 'old', type: 'cardio', name: 'Cycling', color: 'cardio', icon: 'bike', position: 2, archived: true });

const WEEKLY: GoalOut = {
  id: 'weekly',
  tracker_id: 'gym',
  kind: 'frequency',
  period: 'week',
  metric: 'sessions',
  name: null,
  start_date: '2026-11-01',
  end_date: null,
  is_pinned: true,
  target: 3,
  progress: { period_start: '2026-11-23', period_end: '2026-11-29', value: 2, target: 3, expected: null, status: 'on_track' },
  streak_weeks: 4,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};
const DAILY: GoalOut = { ...WEEKLY, id: 'daily', tracker_id: 'water', kind: 'amount', period: 'day', metric: 'count', target: 8, is_pinned: false };

const refetch = jest.fn();

function serve({ trackers = [GYM, WATER, OLD], goals = [WEEKLY, DAILY], pending = false, failed = false } = {}) {
  (useListTrackers as jest.Mock).mockReturnValue({
    isPending: pending,
    data: pending || failed ? undefined : { status: 200, data: { items: trackers } },
    refetch,
  });
  (useListGoals as jest.Mock).mockReturnValue({ isPending: false, data: { status: 200, data: { items: goals } }, refetch });
  (useReadMe as jest.Mock).mockReturnValue({ data: { status: 200, data: { main_tracker_id: 'gym' } } });
}

let client = new QueryClient();

async function open(element: ReactElement) {
  client = new QueryClient();
  await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{element}</ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  serve();
});

afterEach(() => {
  client.clear();
});

describe('Trackers', () => {
  it('lists each tracker with its type, sessions and headline goal, archived ones apart', async () => {
    await open(<TrackersScreen />);

    expect(screen.getByRole('link', { name: 'Gym, Strength · 18 sessions · 3 / week' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Water, General · 1 session · 8 glasses / day' })).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cycling, Cardio · 0 sessions' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('link', { name: /^Water/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/profile/trackers/[id]', params: { id: 'water' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Create tracker' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/profile/trackers/new');
  });

  it('shows placeholders while loading and a retry when the list fails', async () => {
    serve({ pending: true });
    await open(<TrackersScreen />);
    expect(screen.getByLabelText('Loading your trackers')).toBeTruthy();

    serve({ failed: true });
    await open(<TrackersScreen />);
    await fireEvent.press(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('New tracker', () => {
  it('follows the type with name, color and icon until the name is typed by hand', async () => {
    await open(<NewTrackerScreen />);
    expect(screen.getByRole('radio', { name: /^Strength/, checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: /^Cardio/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Tracker name').props.value).toBe('Cardio');

    await fireEvent.changeText(screen.getByLabelText('Tracker name'), 'Morning runs');
    await fireEvent.press(screen.getByText('Back'));
    await fireEvent.press(screen.getByRole('radio', { name: /^Reading/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Tracker name').props.value).toBe('Morning runs');
  });

  it('asks a counting tracker for its unit before going on', async () => {
    await open(<NewTrackerScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: /^General/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'A number' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Choose color & icon' }));

    expect(await screen.findByText('Enter a unit.')).toBeTruthy();
    expect(screen.queryByText('Make it feel like you.')).toBeNull();
  });

  it('creates the tracker and opens its page', async () => {
    (createTracker as jest.Mock).mockResolvedValue({ status: 201, data: { id: 'new-id' } });
    await open(<NewTrackerScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: /^General/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.changeText(screen.getByLabelText('Tracker name'), 'Water');
    await fireEvent.press(screen.getByRole('radio', { name: 'A number' }));
    await fireEvent.changeText(screen.getByLabelText('Unit'), 'glasses');
    await fireEvent.press(screen.getByRole('button', { name: 'Choose color & icon' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Blue' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Droplet' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Create tracker' }));

    expect(createTracker).toHaveBeenCalledWith({
      type: 'general',
      name: 'Water',
      description: null,
      color: 'cardio',
      icon: 'droplet',
      general_mode: 'counter',
      counter_unit: 'glasses',
      counter_unit_note: null,
    });
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/profile/trackers/[id]', params: { id: 'new-id' } });
  });

  it('says why creating failed', async () => {
    (createTracker as jest.Mock).mockRejectedValue(new ApiError({ type: 'about:blank', title: 'x', status: 0, code: 'network_error' }));
    await open(<NewTrackerScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose color & icon' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Create tracker' }));

    expect(await screen.findByText('Can’t reach the server. Check your connection and try again.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('Tracker page', () => {
  beforeEach(() => {
    mockParams = { id: 'gym' };
    (updateTracker as jest.Mock).mockResolvedValue({ status: 200, data: GYM });
  });

  it('saves only what the form edits, never the type', async () => {
    await open(<TrackerScreen />);
    expect(screen.getByText('Strength · 18 sessions')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save changes', disabled: true })).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Tracker name'), 'Home gym');
    await fireEvent.press(screen.getByRole('radio', { name: 'Violet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateTracker).toHaveBeenCalledWith('gym', { name: 'Home gym', description: null, color: 'reading', icon: 'dumbbell' });
    expect(await screen.findByText('Changes saved.')).toBeTruthy();
  });

  it('says the tracker is gone when another device deleted it meanwhile', async () => {
    (updateTracker as jest.Mock).mockRejectedValue(new ApiError({ type: 'about:blank', title: 'Not found', status: 404, code: 'not_found' }));
    await open(<TrackerScreen />);
    await fireEvent.changeText(screen.getByLabelText('Tracker name'), 'Home gym');
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('This tracker no longer exists.')).toBeTruthy();
  });

  it('lists the tracker’s goals and opens a new goal for it', async () => {
    await open(<TrackerScreen />);
    expect(screen.getByRole('link', { name: 'Gym, On track, 2 / 3 sessions' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Create goal' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/profile/goals/new', params: { tracker: 'gym' } });
  });

  it('archives the tracker, or makes another strength tracker the main one', async () => {
    serve({ trackers: [GYM, tracker({ id: 'home', name: 'Home workouts', position: 1 })] });
    mockParams = { id: 'home' };
    (updateMe as jest.Mock).mockResolvedValue({ status: 200, data: { main_tracker_id: 'home' } });
    await open(<TrackerScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Make it the main tracker' }));
    expect(updateMe).toHaveBeenCalledWith({ main_tracker_id: 'home' });

    await fireEvent.press(screen.getByRole('button', { name: 'Archive tracker' }));
    expect(updateTracker).toHaveBeenCalledWith('home', { archived: true });
  });

  it('deletes only after the sheet says the sessions go too', async () => {
    (deleteTracker as jest.Mock).mockResolvedValue({ status: 204 });
    await open(<TrackerScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete tracker' }));

    expect(screen.getByText(/Its sessions \(18 sessions\) and goals are deleted too/)).toBeTruthy();
    expect(deleteTracker).not.toHaveBeenCalled();
    const [, confirm] = screen.getAllByRole('button', { name: 'Delete tracker' });
    await fireEvent.press(confirm);

    expect(deleteTracker).toHaveBeenCalledWith('gym');
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/profile/trackers');
  });

  it('says when the tracker no longer exists', async () => {
    mockParams = { id: 'gone' };
    await open(<TrackerScreen />);
    expect(screen.getByText('This tracker no longer exists.')).toBeTruthy();
  });
});
