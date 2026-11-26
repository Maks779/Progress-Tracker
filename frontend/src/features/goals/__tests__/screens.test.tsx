import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { usePreferences } from '@/features/settings/preferences';
import { ApiError } from '@/shared/api/fetcher';
import { createGoal, deleteGoal, updateGoal, useGetGoal, useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { EditGoalScreen, NewGoalScreen } from '../screens/GoalFormScreen';
import { GoalsScreen } from '../screens/GoalsScreen';

jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/goals/goals', () => ({
  useListGoals: jest.fn(),
  useGetGoal: jest.fn(),
  createGoal: jest.fn(),
  updateGoal: jest.fn(),
  deleteGoal: jest.fn(),
}));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ useReadMe: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() },
}));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), navigate: jest.fn(), canGoBack: () => true };
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

const GYM = tracker({});
const RUN = tracker({ id: 'run', type: 'cardio', name: 'Running', color: 'cardio', icon: 'activity', position: 1 });
const BOOKS = tracker({ id: 'books', type: 'reading', name: 'Reading', color: 'reading', icon: 'book-open', position: 2 });

function goal(overrides: Partial<GoalOut>): GoalOut {
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
    target: 3,
    progress: { period_start: '2026-11-23', period_end: '2026-11-29', value: 2, target: 3, expected: null, status: 'on_track' },
    streak_weeks: 4,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

const GYM_WEEKLY = goal({});
const BOOKS_TOTAL = goal({
  id: 'books-total',
  tracker_id: 'books',
  kind: 'cumulative',
  period: null,
  metric: 'books',
  name: '20 books this year',
  end_date: '2026-12-31',
  is_pinned: false,
  target: 20,
  progress: { period_start: '2026-01-01', period_end: '2026-12-31', value: 14, target: 20, expected: 16, status: 'at_risk' },
  streak_weeks: null,
});
const ARCHIVED_GOAL = goal({ id: 'old', tracker_id: 'archived-tracker' });

function serve({ trackers = [GYM, RUN, BOOKS], goals = [GYM_WEEKLY, BOOKS_TOTAL, ARCHIVED_GOAL] } = {}) {
  (useListTrackers as jest.Mock).mockReturnValue({ isPending: false, data: { status: 200, data: { items: trackers } }, refetch: jest.fn() });
  (useListGoals as jest.Mock).mockReturnValue({ isPending: false, data: { status: 200, data: { items: goals } }, refetch: jest.fn() });
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
  usePreferences.setState((state) => ({ values: { ...state.values, distance_unit: 'km' } }));
  serve();
  (createGoal as jest.Mock).mockResolvedValue({ status: 201, data: {} });
  (updateGoal as jest.Mock).mockResolvedValue({ status: 200, data: {} });
  (deleteGoal as jest.Mock).mockResolvedValue({ status: 204 });
});

afterEach(() => {
  client.clear();
});

describe('Goals', () => {
  it('shows the goals of active trackers with their status and the main tracker’s streak', async () => {
    await open(<GoalsScreen />);

    expect(screen.getByRole('link', { name: 'Gym, On track, 2 / 3 sessions' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '20 books this year, At risk, 14 / 20 books · 70%' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /old/ })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByText('4 weeks of showing up.')).toBeTruthy();
    expect(screen.getByText('Your Gym streak is 4 weeks. Reach this week’s goal to make it 5.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('link', { name: /^20 books/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/profile/goals/[id]', params: { id: 'books-total' } });
  });

  it('explains streaks when the main tracker has no weekly goal, and invites a first goal', async () => {
    serve({ goals: [] });
    await open(<GoalsScreen />);

    expect(screen.getByText('No goals yet. A weekly goal starts your streak.')).toBeTruthy();
    expect(screen.getByText('Aim for repeatable, not perfect.')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Create goal' })[0]);
    expect(mockRouter.push).toHaveBeenCalledWith('/profile/goals/new');
  });
});

describe('New goal', () => {
  it('creates a weekly frequency goal with the stepper', async () => {
    serve({ goals: [] });
    await open(<NewGoalScreen />);
    expect(screen.getByRole('button', { name: 'Tracker: Gym' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'More sessions' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create goal' }));

    expect(createGoal).toHaveBeenCalledWith({ tracker_id: 'gym', kind: 'frequency', period: 'week', metric: 'sessions', target: 4 });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('returns to Home when Home opened the form, after saving or cancelling', async () => {
    serve({ goals: [] });
    mockParams = { tracker: 'gym', from: 'home' };
    await open(<NewGoalScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/profile');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/');

    jest.clearAllMocks();
    await fireEvent.press(screen.getByRole('button', { name: 'Create goal' }));
    expect(createGoal).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith('/');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('turns kilometres and miles into metres for amount goals', async () => {
    mockParams = { tracker: 'run' };
    await open(<NewGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Amount' }));
    await fireEvent.changeText(screen.getByLabelText('Target · km / week'), '12,5');
    await fireEvent.press(screen.getByRole('button', { name: 'Create goal' }));
    expect(createGoal).toHaveBeenLastCalledWith({ tracker_id: 'run', kind: 'amount', period: 'week', metric: 'distance', target: 12500 });

    usePreferences.setState((state) => ({ values: { ...state.values, distance_unit: 'mi' } }));
    await open(<NewGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Amount' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Per day' }));
    await fireEvent.changeText(screen.getByLabelText('Target · mi / day'), '3');
    await fireEvent.press(screen.getByRole('button', { name: 'Create goal' }));
    expect(createGoal).toHaveBeenLastCalledWith({ tracker_id: 'run', kind: 'amount', period: 'day', metric: 'distance', target: 4828 });
  });

  it('creates a cumulative goal with a name and an end date', async () => {
    mockParams = { tracker: 'books' };
    serve({ goals: [] });
    await open(<NewGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Cumulative' }));
    await fireEvent.changeText(screen.getByLabelText('Goal name · optional'), '  20 books this year ');
    await fireEvent.changeText(screen.getByLabelText('Target · books'), '20');
    await fireEvent.press(screen.getByRole('button', { name: 'Create goal' }));

    expect(createGoal).toHaveBeenCalledWith({
      tracker_id: 'books',
      kind: 'cumulative',
      metric: 'books',
      target: 20,
      name: '20 books this year',
      end_date: `${new Date().getFullYear()}-12-31`,
    });
  });

  it('refuses a target that is not a whole number above zero', async () => {
    mockParams = { tracker: 'books' };
    await open(<NewGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Amount' }));
    await fireEvent.changeText(screen.getByLabelText('Target · pages / week'), '12.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Create goal' }));

    expect(screen.getByText('Enter a whole number above zero.')).toBeTruthy();
    expect(createGoal).not.toHaveBeenCalled();
  });

  it('points to the goal that already exists instead of sending a twin', async () => {
    await open(<NewGoalScreen />);

    expect(screen.getByText('This tracker already has a goal like this.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create goal', disabled: true })).toBeTruthy();
    await fireEvent.press(screen.getByText('Edit that goal'));
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/profile/goals/[id]', params: { id: 'gym-weekly' } });
  });

  it('offers to pin a second weekly goal and sends the pin', async () => {
    mockParams = { tracker: 'run' };
    serve({ goals: [goal({ id: 'run-weekly', tracker_id: 'run' })] });
    await open(<NewGoalScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Amount' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Pin this goal/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create goal' }));

    expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ kind: 'amount', is_pinned: true }));
  });

  it('says when the server already has the goal', async () => {
    serve({ goals: [] });
    (createGoal as jest.Mock).mockRejectedValue(
      new ApiError({ type: 'about:blank', title: 'Conflict', status: 409, code: 'goal_exists' }),
    );
    await open(<NewGoalScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Create goal' }));

    expect(await screen.findByText('This tracker already has a goal like this.')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});

describe('Edit goal', () => {
  beforeEach(() => {
    mockParams = { id: 'books-total' };
    (useGetGoal as jest.Mock).mockReturnValue({ isPending: false, data: { status: 200, data: BOOKS_TOTAL } });
  });

  it('keeps the tracker and kind, and sends only what changed', async () => {
    await open(<EditGoalScreen />);
    expect(screen.getByText('Cumulative · Books')).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Goal type' })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Target · books'), '24');
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateGoal).toHaveBeenCalledWith('books-total', { target: 24 });
  });

  it('deletes the goal after the sheet', async () => {
    await open(<EditGoalScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete goal' }));
    expect(screen.getByText('Its progress history goes with it. Your sessions stay.')).toBeTruthy();
    const [, confirm] = screen.getAllByRole('button', { name: 'Delete goal' });
    await fireEvent.press(confirm);

    expect(deleteGoal).toHaveBeenCalledWith('books-total');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('says when the goal no longer exists', async () => {
    (useGetGoal as jest.Mock).mockReturnValue({ isPending: false, isError: true, data: undefined });
    await open(<EditGoalScreen />);
    expect(screen.getByText('This goal no longer exists.')).toBeTruthy();
  });
});
