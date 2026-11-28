import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { useAuthStore } from '@/features/auth/store';
import { usePreferences } from '@/features/settings/preferences';
import { useWorkout } from '@/features/workout/store';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { GoalOut } from '@/shared/api/generated/model';
import i18n from '@/shared/i18n';
import {
  allowExactAlarms,
  askNotificationPermission,
  cancelAllNotifications,
  cancelNotification,
  scheduleNotification,
} from '@/shared/notifications/notifications';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

import { NotificationAskSheet, NotificationsCard } from '../components';
import { useNotifications } from '../store';
import { useNotificationSync } from '../useNotificationSync';

jest.mock('@/shared/notifications/notifications', () => ({
  NOTIFICATIONS_AVAILABLE: true,
  setUpNotifications: jest.fn(async () => undefined),
  notificationPermission: jest.fn(async () => 'undetermined'),
  askNotificationPermission: jest.fn(),
  alarmsMayBeLate: jest.fn(async () => false),
  allowExactAlarms: jest.fn(),
  scheduleNotification: jest.fn(async () => undefined),
  cancelNotification: jest.fn(async () => undefined),
  cancelAllNotifications: jest.fn(async () => undefined),
}));
jest.mock('@/shared/api/generated/endpoints/me/me', () => ({
  useReadMe: () => ({ data: { status: 200, data: { id: 'me' } } }),
  updateMe: jest.fn(),
}));
jest.mock('@/shared/api/generated/endpoints/goals/goals', () => ({ useListGoals: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/trackers/trackers', () => ({ useListTrackers: jest.fn() }));

const goal = (tracker_id: string, target: number, value: number) =>
  ({ id: tracker_id, tracker_id, kind: 'frequency', period: 'week', target, is_pinned: false, progress: { value, target } }) as GoalOut;

function serveGoals(goals: GoalOut[]) {
  jest.mocked(useListGoals).mockReturnValue({ data: { status: 200, data: { items: goals } } } as never);
}

function Sync() {
  useNotificationSync();
  return null;
}

let client: QueryClient;

async function show(element: React.ReactElement) {
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{element}</ThemeProvider>
    </QueryClientProvider>,
  );
}

const draft = (endsAt: number | null) => ({
  version: 1 as const,
  id: 'session-1',
  userId: 'me',
  trackerId: 'gym',
  name: 'Upper body A',
  startedAt: new Date().toISOString(),
  localDate: '2026-11-27',
  exercises: [],
  rest: endsAt === null ? null : { endsAt, seconds: 90 },
});

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  client = new QueryClient();
  useAuthStore.setState({ status: 'signedIn' });
  useNotifications.setState({ hydrated: true, permission: 'granted', asked: true, lateAlarms: false });
  usePreferences.setState((current) => ({ values: { ...current.values, notify_rest_timer: true, notify_weekly_reminder: true }, pending: [] }));
  useWorkout.setState({ hydrated: true, draft: null, summary: null });
  jest.mocked(useListTrackers).mockReturnValue({
    data: { status: 200, data: { items: [{ id: 'gym', name: 'Gym', archived: false }, { id: 'read', name: 'Reading', archived: false }] } },
  } as never);
  serveGoals([goal('gym', 3, 1), goal('read', 2, 1)]);
});

afterEach(() => {
  client.clear();
});

describe('Scheduled notifications', () => {
  it('follow the rest: set when it starts, moved when it grows, gone when it ends', async () => {
    const endsAt = Date.now() + 90_000;
    useWorkout.setState({ draft: draft(endsAt) });
    await show(<Sync />);
    expect(scheduleNotification).toHaveBeenCalledWith('rest', new Date(endsAt), { title: 'Rest’s done.', body: 'Back to Upper body A when you’re ready.' });

    await act(async () => useWorkout.setState({ draft: draft(endsAt + 30_000) }));
    expect(scheduleNotification).toHaveBeenLastCalledWith('rest', new Date(endsAt + 30_000), expect.anything());

    jest.mocked(cancelNotification).mockClear();
    await act(async () => useWorkout.setState({ draft: draft(null) }));
    expect(cancelNotification).toHaveBeenCalledWith('rest');
    await act(async () => useWorkout.setState({ draft: null }));
    expect(cancelNotification).toHaveBeenCalledWith('rest');
  });

  it('plan the weekly reminder for the goals still within reach, and drop it once they are met', async () => {
    await show(<Sync />);
    expect(scheduleNotification).toHaveBeenCalledWith('weekly', expect.any(Date), {
      title: 'Your week isn’t over yet.',
      body: 'Still within reach: Reading and Gym.',
    });
    const [, at] = jest.mocked(scheduleNotification).mock.calls.find(([kind]) => kind === 'weekly')!;
    expect(at.getDay()).toBe(5);
    expect(at.getHours()).toBe(18);

    jest.mocked(cancelNotification).mockClear();
    serveGoals([goal('gym', 3, 3), goal('read', 2, 2)]);
    await act(async () => client.invalidateQueries());
    await show(<Sync />);
    expect(cancelNotification).toHaveBeenCalledWith('weekly');
  });

  it('are set again once Android allows exact alarms, so they come on time', async () => {
    useNotifications.setState({ lateAlarms: true });
    const endsAt = Date.now() + 90_000;
    useWorkout.setState({ draft: draft(endsAt) });
    await show(<Sync />);
    jest.mocked(scheduleNotification).mockClear();

    await act(async () => useNotifications.setState({ lateAlarms: false }));
    expect(scheduleNotification).toHaveBeenCalledWith('rest', new Date(endsAt), expect.anything());
    expect(scheduleNotification).toHaveBeenCalledWith('weekly', expect.any(Date), expect.anything());
  });

  it('schedule nothing without the toggle or the permission, and clear all at sign-out', async () => {
    usePreferences.setState((current) => ({ values: { ...current.values, notify_rest_timer: false, notify_weekly_reminder: false } }));
    useWorkout.setState({ draft: draft(Date.now() + 90_000) });
    await show(<Sync />);
    expect(scheduleNotification).not.toHaveBeenCalled();
    expect(cancelNotification).toHaveBeenCalledWith('rest');
    expect(cancelNotification).toHaveBeenCalledWith('weekly');

    await act(async () => useAuthStore.setState({ status: 'signedOut' }));
    expect(cancelAllNotifications).toHaveBeenCalled();
  });
});

describe('Notifications in Settings', () => {
  it('turn on after the system allows them, both at once', async () => {
    useNotifications.setState({ permission: 'undetermined', asked: false });
    jest.mocked(askNotificationPermission).mockResolvedValue('granted');
    await show(<NotificationsCard />);
    expect(screen.getByRole('switch', { name: 'Rest timer', checked: false })).toBeTruthy();

    await act(() => fireEvent.press(screen.getByRole('switch', { name: 'Rest timer' })));
    expect(askNotificationPermission).toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Rest timer', checked: true })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Weekly reminder', checked: true })).toBeTruthy();

    await act(() => fireEvent.press(screen.getByRole('switch', { name: 'Weekly reminder' })));
    expect(usePreferences.getState().values.notify_weekly_reminder).toBe(false);
    expect(usePreferences.getState().pending).toContain('notify_weekly_reminder');
  });

  it('say so when the phone blocks them, and open the phone’s settings', async () => {
    useNotifications.setState({ permission: 'denied' });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await show(<NotificationsCard />);
    expect(screen.getByText('Notifications are off for Ember in your phone’s settings.')).toBeTruthy();
    await act(() => fireEvent.press(screen.getByRole('link', { name: 'Open settings' })));
    expect(openSettings).toHaveBeenCalled();
  });

  it('offer on-time rest alerts while Android would send them late', async () => {
    const late = 'Rest alerts may arrive late on this phone. Allow Alarms & reminders for Ember to get them on time.';
    useNotifications.setState({ lateAlarms: true });
    usePreferences.setState((current) => ({ values: { ...current.values, notify_rest_timer: false } }));
    jest.mocked(allowExactAlarms).mockResolvedValue(false);
    await show(<NotificationsCard />);
    expect(screen.queryByText(late)).toBeNull();

    await act(async () => usePreferences.setState((current) => ({ values: { ...current.values, notify_rest_timer: true } })));
    expect(screen.getByText(late)).toBeTruthy();
    await act(() => fireEvent.press(screen.getByRole('link', { name: 'Allow alarms & reminders' })));
    expect(allowExactAlarms).toHaveBeenCalled();
    expect(screen.queryByText(late)).toBeNull();
  });

  it('are asked for once in context; Not now is remembered', async () => {
    useNotifications.setState({ permission: 'undetermined', asked: false });
    const onClose = jest.fn();
    await show(<NotificationAskSheet onClose={onClose} />);
    expect(screen.getByText('A nudge, on your terms.')).toBeTruthy();
    await act(() => fireEvent.press(screen.getByRole('button', { name: 'Not now' })));
    expect(askNotificationPermission).not.toHaveBeenCalled();
    expect(useNotifications.getState().asked).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem('ember.notifications')) ?? '{}')).toEqual({ asked: true });
    expect(onClose).toHaveBeenCalled();
  });
});
