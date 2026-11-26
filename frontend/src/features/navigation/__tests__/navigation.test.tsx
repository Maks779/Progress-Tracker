import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import HomeLayout, { unstable_settings as homeSettings } from '@/app/(tabs)/(home)/_layout';
import TabsLayout from '@/app/(tabs)/_layout';
import ProfileLayout, { unstable_settings } from '@/app/(tabs)/profile/_layout';
import { useWorkout } from '@/features/workout/store';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import i18n from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';
import { Screen } from '@/shared/ui/Screen';

let mockWidth = 1440;
jest.mock('@/shared/theme/breakpoints', () => {
  const actual = jest.requireActual('@/shared/theme/breakpoints');
  return {
    ...actual,
    useBreakpoint: () => actual.breakpointFor(mockWidth),
    useTwoColumns: () => actual.hasTwoColumns(mockWidth),
  };
});
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({
  useReadMe: () => ({
    data: { status: 200, data: { id: 'me', name: 'Alex Morgan', email: 'alex@example.com', main_tracker_id: 'gym' } },
    isPending: false,
  }),
}));
jest.mock('@/shared/api/generated/endpoints/stats/stats', () => ({
  useHome: () => ({ data: { status: 200, data: { main_tracker_id: 'gym', up_next: null } } }),
}));
jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));

function page(title: string, back?: { label: string; step?: boolean }) {
  return function Page() {
    return <Screen title={title} back={back ? { ...back, onPress: jest.fn() } : undefined} />;
  };
}

type State = { routes: { name: string; state?: State }[] };

function stackOf(state: State | undefined, name: string): string[] | undefined {
  for (const route of state?.routes ?? []) {
    if (route.name === name) {
      return route.state?.routes.map((child) => child.name);
    }
    const found = stackOf(route.state, name);
    if (found) {
      return found;
    }
  }
  return undefined;
}

let client: QueryClient;

function open(url: string) {
  return renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <ThemeProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </QueryClientProvider>
      ),
      '(tabs)/_layout': TabsLayout,
      '(tabs)/(home)/_layout': { default: HomeLayout, unstable_settings: homeSettings },
      '(tabs)/(home)/index': page('Home page'),
      '(tabs)/(home)/workout/index': page('Workout page'),
      '(tabs)/(home)/workout/add-exercise': page('Add exercise page'),
      '(tabs)/history': page('History page'),
      '(tabs)/log': page('Log page'),
      '(tabs)/progress': page('Progress page'),
      '(tabs)/profile/_layout': { default: ProfileLayout, unstable_settings },
      '(tabs)/profile/index': page('Profile page'),
      '(tabs)/profile/goals/index': page('Goals page', { label: 'Back to profile' }),
      '(tabs)/profile/goals/[id]': page('Goal page'),
      '(tabs)/profile/trackers/index': page('Trackers page'),
      '(tabs)/profile/trackers/new': page('New tracker page', { label: 'Previous step', step: true }),
      '(tabs)/profile/trackers/[id]': page('Tracker page'),
    },
    { initialUrl: url },
  );
}

const sidebar = () => screen.getByLabelText('Main menu');
const breadcrumb = () => screen.getByLabelText('Breadcrumb');
const press = (element: Parameters<typeof fireEvent.press>[0]) => act(() => fireEvent.press(element));

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  mockWidth = 1440;
  client = new QueryClient();
  useWorkout.setState({ hydrated: true, draft: null, summary: null });
  jest.mocked(useListTrackers).mockReturnValue({
    data: { status: 200, data: { items: [{ id: 'gym', name: 'Gym', type: 'strength', archived: false }] } },
  } as unknown as ReturnType<typeof useListTrackers>);
});

afterEach(() => {
  client.clear();
});

describe('desktop', () => {
  it('replaces the tab bar with the sidebar and marks the section on screen', async () => {
    await open('/history');
    const nav = within(sidebar());
    for (const name of ['Home', 'History', 'Progress', 'Profile', 'Goals', 'Trackers']) {
      expect(nav.getByRole('link', { name })).toBeTruthy();
    }
    expect(nav.getByRole('link', { name: 'History', selected: true })).toBeTruthy();
    expect(nav.getByRole('link', { name: 'Home', selected: false })).toBeTruthy();
    expect(nav.getByRole('link', { name: 'Alex Morgan, profile' })).toBeTruthy();
    expect(screen.queryByLabelText('Log')).toBeNull();
    expect(within(breadcrumb()).getByText('History')).toBeTruthy();
  });

  it('opens Goals from the sidebar inside the Profile section, and the breadcrumb leads back', async () => {
    await open('/');
    await press(within(sidebar()).getByRole('link', { name: 'Goals' }));
    expect(screen).toHavePathname('/profile/goals');
    expect(within(sidebar()).getByRole('link', { name: 'Profile', selected: true })).toBeTruthy();
    expect(within(breadcrumb()).getByText('Goals')).toBeTruthy();

    await press(within(breadcrumb()).getByRole('link', { name: 'Profile' }));
    expect(screen).toHavePathname('/profile');
  });

  it('switches between Goals and Trackers without stacking pages', async () => {
    const app = await open('/profile/goals/abc');
    await press(within(sidebar()).getByRole('link', { name: 'Trackers' }));
    expect(screen).toHavePathname('/profile/trackers');
    await press(within(sidebar()).getByRole('link', { name: 'Goals' }));
    expect(screen).toHavePathname('/profile/goals');
    expect(stackOf(app.getRouterState() as State, 'profile')).toEqual(['index', 'goals/index']);
  });

  it('names the tracker in the breadcrumb and leads back to the list', async () => {
    await open('/profile/trackers/gym');
    const trail = within(breadcrumb());
    expect(trail.getByText('Gym')).toBeTruthy();
    expect(trail.getByRole('link', { name: 'Profile' })).toBeTruthy();
    await press(trail.getByRole('link', { name: 'Trackers' }));
    expect(screen).toHavePathname('/profile/trackers');
  });

  it('falls back to a plain label while the tracker list is loading', async () => {
    jest.mocked(useListTrackers).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useListTrackers>);
    await open('/profile/trackers/gym');
    expect(within(breadcrumb()).getByText('Tracker')).toBeTruthy();
  });

  it('keeps a section where it was, and a second press goes back to its first page', async () => {
    await open('/profile/goals');
    await press(within(sidebar()).getByRole('link', { name: 'Home' }));
    expect(screen).toHavePathname('/');
    await press(within(sidebar()).getByRole('link', { name: 'Profile' }));
    expect(screen).toHavePathname('/profile/goals');
    await press(within(sidebar()).getByRole('link', { name: 'Profile' }));
    await waitFor(() => expect(screen).toHavePathname('/profile'));
  });

  it('opens Profile itself from the account', async () => {
    await open('/profile/goals');
    await press(within(sidebar()).getByRole('link', { name: 'Home' }));
    await press(within(sidebar()).getByRole('link', { name: 'Alex Morgan, profile' }));
    expect(screen).toHavePathname('/profile');
  });

  it('leaves the way back to the parent page to the breadcrumb', async () => {
    await open('/profile/goals');
    expect(screen.getByText('Goals page')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Back to profile' })).toBeNull();
  });

  it('keeps a step back inside a page', async () => {
    await open('/profile/trackers/new');
    expect(screen.getByRole('link', { name: 'Previous step' })).toBeTruthy();
  });
});

describe('workout', () => {
  it('starts from the sidebar on any page and opens over Home, then offers to resume it', async () => {
    const app = await open('/profile/goals');
    await press(within(sidebar()).getByRole('button', { name: 'Start workout' }));
    await waitFor(() => expect(screen).toHavePathname('/workout'));
    expect(within(sidebar()).getByRole('link', { name: 'Home', selected: true })).toBeTruthy();
    expect(stackOf(app.getRouterState() as State, '(home)')).toEqual(['index', 'workout/index']);
    expect(useWorkout.getState().draft).toMatchObject({ userId: 'me', trackerId: 'gym', name: 'Gym' });
    expect(within(sidebar()).getByRole('button', { name: 'Resume workout' })).toBeTruthy();

    await press(within(breadcrumb()).getByRole('link', { name: 'Home' }));
    expect(screen).toHavePathname('/');
    expect(useWorkout.getState().draft).not.toBeNull();
  });

  it('names the workout pages in the breadcrumb', async () => {
    await open('/workout/add-exercise');
    const trail = within(breadcrumb());
    expect(trail.getByRole('link', { name: 'Home' })).toBeTruthy();
    expect(trail.getByText('Add exercise')).toBeTruthy();
    await press(trail.getByRole('link', { name: 'Workout' }));
    expect(screen).toHavePathname('/workout');
  });
});

describe('tablet', () => {
  beforeEach(() => {
    mockWidth = 768;
  });

  it('shows the top bar with the logo and the account over the tab bar', async () => {
    await open('/');
    expect(screen.getByLabelText('Ember')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Alex M., profile' })).toBeTruthy();
    expect(screen.getByLabelText('Log')).toBeTruthy();
    expect(screen.queryByLabelText('Main menu')).toBeNull();
    expect(screen.queryByLabelText('Breadcrumb')).toBeNull();
  });

  it('keeps the back link and opens Profile from the account', async () => {
    await open('/profile/goals');
    expect(screen.getByRole('link', { name: 'Back to profile' })).toBeTruthy();
    await press(screen.getByRole('link', { name: 'Alex M., profile' }));
    expect(screen).toHavePathname('/profile');
  });

  it('opens Profile from another tab with the account', async () => {
    await open('/history');
    await press(screen.getByRole('link', { name: 'Alex M., profile' }));
    expect(screen).toHavePathname('/profile');
  });
});

describe('phone', () => {
  it('has only the tab bar', async () => {
    mockWidth = 390;
    await open('/profile/goals');
    expect(screen.getByLabelText('Log')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Alex M., profile' })).toBeNull();
    expect(screen.queryByLabelText('Main menu')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to profile' })).toBeTruthy();
  });
});
