import {
  AndroidImportance,
  cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync,
  getExactAlarmPermissionsAsync,
  getPermissionsAsync,
  IosAuthorizationStatus,
  type NotificationPermissionsStatus,
  type PermissionResponse,
  requestExactAlarmPermissionsAsync,
  requestPermissionsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';

/** Local notifications on Android and iOS (decision #8, decisions §3.9); the web build has none. */
export const NOTIFICATIONS_AVAILABLE = true;

export type Permission = 'granted' | 'denied' | 'undetermined';

/** The two notifications the app ever schedules; scheduling one again replaces it. */
export type NotificationKind = 'rest' | 'weekly';

const CHANNEL = 'ember';

/** Ember's own Android channel once it exists; Expo Go refuses to make it, and the default one is used. */
let channelId: string | undefined;

function toPermission(answer: NotificationPermissionsStatus): Permission {
  if (answer.granted || answer.ios?.status === IosAuthorizationStatus.PROVISIONAL) {
    return 'granted';
  }
  return answer.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Once at start-up: the rest notification stays silent while the app is on screen (spec §3.11:
 * the timer on screen is enough), the weekly reminder shows. Android needs a channel before it
 * can ask for permission: Ember's own, or the default one where making it fails (Expo Go).
 */
export async function setUpNotifications(channelName: string): Promise<void> {
  setNotificationHandler({
    handleNotification: async (notification) => {
      const shown = notification.request.identifier !== 'rest';
      return { shouldShowBanner: shown, shouldShowList: shown, shouldPlaySound: shown, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    try {
      await setNotificationChannelAsync(CHANNEL, { name: channelName, importance: AndroidImportance.HIGH });
      channelId = CHANNEL;
    } catch {
      channelId = undefined;
    }
  }
}

export async function notificationPermission(): Promise<Permission> {
  return toPermission(await getPermissionsAsync());
}

/** Asks the system; when it was refused for good it answers at once without a prompt. */
export async function askNotificationPermission(): Promise<Permission> {
  return toPermission(await requestPermissionsAsync());
}

function lateWithout(answer: PermissionResponse): boolean {
  return !answer.granted && answer.canAskAgain;
}

/**
 * Android 14 and later deliver a scheduled notification up to three quarters of the wait late
 * unless the person allows exact alarms ("Alarms & reminders"). True while they could still
 * allow them; never on iOS, and never where the system offers no choice.
 */
export async function alarmsMayBeLate(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  return lateWithout(await getExactAlarmPermissionsAsync());
}

/** Opens the phone's "Alarms & reminders" page and answers once the person is back. */
export async function allowExactAlarms(): Promise<boolean> {
  return lateWithout(await requestExactAlarmPermissionsAsync());
}

export async function scheduleNotification(kind: NotificationKind, at: Date, content: { title: string; body: string }): Promise<void> {
  await scheduleNotificationAsync({
    identifier: kind,
    content: { title: content.title, body: content.body, data: { kind } },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: at, channelId },
  });
}

export async function cancelNotification(kind: NotificationKind): Promise<void> {
  await cancelScheduledNotificationAsync(kind);
}

export async function cancelAllNotifications(): Promise<void> {
  await cancelAllScheduledNotificationsAsync();
}
