/** The web build: no notifications (decision #8), and expo-notifications stays out of the bundle. */
export const NOTIFICATIONS_AVAILABLE = false;

export type Permission = 'granted' | 'denied' | 'undetermined';

export type NotificationKind = 'rest' | 'weekly';

export async function setUpNotifications(_channelName: string): Promise<void> {}

export async function notificationPermission(): Promise<Permission> {
  return 'denied';
}

export async function askNotificationPermission(): Promise<Permission> {
  return 'denied';
}

export async function alarmsMayBeLate(): Promise<boolean> {
  return false;
}

export async function allowExactAlarms(): Promise<boolean> {
  return false;
}

export async function scheduleNotification(_kind: NotificationKind, _at: Date, _content: { title: string; body: string }): Promise<void> {}

export async function cancelNotification(_kind: NotificationKind): Promise<void> {}

export async function cancelAllNotifications(): Promise<void> {}
