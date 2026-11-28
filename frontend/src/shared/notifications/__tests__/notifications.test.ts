import {
  getExactAlarmPermissionsAsync,
  type Notification,
  requestExactAlarmPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';

import { alarmsMayBeLate, allowExactAlarms, askNotificationPermission, scheduleNotification, setUpNotifications } from '../notifications';

const answer = (granted: boolean, canAskAgain: boolean) =>
  ({ granted, canAskAgain, status: granted ? 'granted' : 'denied', expires: 'never' }) as never;

const lastTrigger = () => jest.mocked(scheduleNotificationAsync).mock.calls.at(-1)?.[0].trigger;

afterEach(() => {
  jest.restoreAllMocks();
});

describe('notifications on a phone', () => {
  it('use the default Android channel where Ember’s own cannot be made, as in Expo Go', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.mocked(setNotificationChannelAsync).mockRejectedValueOnce(new Error('NullPointerException'));
    await setUpNotifications('Ember');
    await scheduleNotification('rest', new Date(90_000), { title: 'Rest’s done.', body: 'Back to it.' });
    expect(lastTrigger()).toEqual({ type: 'date', date: new Date(90_000), channelId: undefined });

    await setUpNotifications('Ember');
    await scheduleNotification('weekly', new Date(90_000), { title: 'Your week isn’t over yet.', body: 'Gym.' });
    expect(lastTrigger()).toEqual({ type: 'date', date: new Date(90_000), channelId: 'ember' });
    expect(jest.mocked(scheduleNotificationAsync).mock.calls.at(-1)?.[0].identifier).toBe('weekly');
  });

  it('keep the rest alert silent while the app is on screen, and show the weekly reminder', async () => {
    await setUpNotifications('Ember');
    const handler = jest.mocked(setNotificationHandler).mock.calls.at(-1)?.[0];
    const arriving = (identifier: string) => ({ request: { identifier } }) as Notification;
    expect(await handler?.handleNotification(arriving('rest'))).toMatchObject({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false });
    expect(await handler?.handleNotification(arriving('weekly'))).toMatchObject({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true });
  });

  it('tell an answer for good from one still open', async () => {
    jest.mocked(requestPermissionsAsync).mockResolvedValueOnce(answer(true, true));
    expect(await askNotificationPermission()).toBe('granted');
    jest.mocked(requestPermissionsAsync).mockResolvedValueOnce(answer(false, true));
    expect(await askNotificationPermission()).toBe('undetermined');
    jest.mocked(requestPermissionsAsync).mockResolvedValueOnce(answer(false, false));
    expect(await askNotificationPermission()).toBe('denied');
  });

  it('may come late only on Android without exact alarms, while the person can still allow them', async () => {
    expect(await alarmsMayBeLate()).toBe(false);

    jest.replaceProperty(Platform, 'OS', 'android');
    jest.mocked(getExactAlarmPermissionsAsync).mockResolvedValueOnce(answer(false, true));
    expect(await alarmsMayBeLate()).toBe(true);
    jest.mocked(getExactAlarmPermissionsAsync).mockResolvedValueOnce(answer(false, false));
    expect(await alarmsMayBeLate()).toBe(false);
    jest.mocked(getExactAlarmPermissionsAsync).mockResolvedValueOnce(answer(true, true));
    expect(await alarmsMayBeLate()).toBe(false);

    jest.mocked(requestExactAlarmPermissionsAsync).mockResolvedValueOnce(answer(true, true));
    expect(await allowExactAlarms()).toBe(false);
  });
});
