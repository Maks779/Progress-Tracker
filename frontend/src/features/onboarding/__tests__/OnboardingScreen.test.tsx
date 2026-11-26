import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/shared/api/fetcher';
import { createGoal } from '@/shared/api/generated/endpoints/goals/goals';
import { createTracker } from '@/shared/api/generated/endpoints/trackers/trackers';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { OnboardingScreen } from '../OnboardingScreen';
import { useOnboarding } from '../store';

jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({
  createTracker: jest.fn(),
  getListTrackersQueryKey: () => ['/api/v1/trackers'],
}));
jest.mock('@/shared/api/generated/endpoints/goals/goals', () => ({ createGoal: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ getReadMeQueryKey: () => ['/api/v1/me'] }));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: unknown }) => children }));

async function open() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <OnboardingScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  jest.clearAllMocks();
  useOnboarding.setState({ status: 'needed' });
  let next = 0;
  (createTracker as jest.Mock).mockImplementation(async (body: { type: string }) => ({
    status: 201,
    data: { id: `${body.type}-${(next += 1)}` },
  }));
  (createGoal as jest.Mock).mockResolvedValue({ status: 201, data: {} });
});

describe('Onboarding', () => {
  it('starts with strength chosen and needs at least one choice', async () => {
    await open();
    expect(screen.getByText('Step 01 / 03')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /^Strength/, checked: true })).toBeTruthy();

    await fireEvent.press(screen.getByRole('checkbox', { name: /^Strength/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Choose at least one to continue.')).toBeTruthy();
    expect(screen.queryByText('Find your weekly rhythm.')).toBeNull();
  });

  it('asks for one weekly goal per chosen tracker and keeps it within limits', async () => {
    await open();
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Reading/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Strength · Gym')).toBeTruthy();
    expect(screen.getByText('Reading')).toBeTruthy();
    expect(screen.queryByText('Reading · Reading')).toBeNull();
    expect(screen.getByText('60')).toBeTruthy();
    for (let tap = 0; tap < 6; tap += 1) {
      await fireEvent.press(screen.getByRole('button', { name: 'More: Strength · Gym' }));
    }
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More: Strength · Gym', disabled: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set weekly goals' })).toBeTruthy();
  });

  it('creates the trackers and goals, then shows the lineup and opens Home', async () => {
    await open();
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Reading/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fewer: Strength · Gym' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Set weekly goals' }));

    expect(createTracker).toHaveBeenCalledWith(expect.objectContaining({ type: 'strength', name: 'Gym' }));
    expect(createTracker).toHaveBeenCalledWith(expect.objectContaining({ type: 'reading', name: 'Reading' }));
    expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ tracker_id: 'strength-1', target: 2, metric: 'sessions' }));
    expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ tracker_id: 'reading-2', target: 60, metric: 'pages' }));
    expect(await screen.findByText('Your starting lineup')).toBeTruthy();
    expect(screen.getByText('Gym · 2 sessions / week')).toBeTruthy();
    expect(screen.getByText('Reading · 60 pages / week')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Let’s begin' }));
    expect(useOnboarding.getState().status).toBe('done');
  });

  it('says why saving failed, hides Back once something exists, and retries without twins', async () => {
    (createGoal as jest.Mock).mockRejectedValueOnce(
      new ApiError({ type: 'about:blank', title: 'x', status: 0, code: 'network_error' }),
    );
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Set weekly goal' }));

    expect(await screen.findByText('Can’t reach the server. Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByText('Back')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Set weekly goal' }));
    expect(createTracker).toHaveBeenCalledTimes(1);
    expect(createGoal).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Your starting lineup')).toBeTruthy();
  });

  it('goes back from goals to the choice while nothing was created', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await fireEvent.press(screen.getByText('Back'));

    expect(screen.getByText('What do you want to track?')).toBeTruthy();
  });
});
