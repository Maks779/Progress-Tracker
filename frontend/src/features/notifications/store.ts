import { create } from 'zustand';

import { changePreference } from '@/features/settings/preferences';
import {
  alarmsMayBeLate,
  allowExactAlarms,
  askNotificationPermission,
  NOTIFICATIONS_AVAILABLE,
  notificationPermission,
  type Permission,
} from '@/shared/notifications/notifications';
import { storage } from '@/shared/storage/storage';

const STORAGE_KEY = 'ember.notifications';

type State = { hydrated: boolean; permission: Permission | null; asked: boolean; lateAlarms: boolean };

/**
 * This device's side of notifications: what the system allows, whether the app has asked in
 * context already (spec §3.11), so it never asks twice by itself, and whether Android may
 * deliver them late. The toggles live in the preferences, which follow the account.
 */
export const useNotifications = create<State>()(() => ({ hydrated: false, permission: null, asked: false, lateAlarms: false }));

const checkLateAlarms = () => alarmsMayBeLate().catch(() => false);

export async function hydrateNotifications(): Promise<void> {
  if (!NOTIFICATIONS_AVAILABLE) {
    useNotifications.setState({ hydrated: true, permission: 'denied', asked: true });
    return;
  }
  const saved = await storage.read<{ asked?: unknown }>(STORAGE_KEY);
  const permission = await notificationPermission().catch((): Permission => 'undetermined');
  useNotifications.setState({ hydrated: true, permission, asked: saved?.asked === true, lateAlarms: await checkLateAlarms() });
}

/** The system's answers may change in the phone's settings while the app is away. */
export async function refreshPermission(): Promise<void> {
  if (NOTIFICATIONS_AVAILABLE) {
    const permission = await notificationPermission().catch((): Permission => 'undetermined');
    useNotifications.setState({ permission, lateAlarms: await checkLateAlarms() });
  }
}

/** Sends the person to "Alarms & reminders", so rest alerts come at the end of the rest. */
export async function allowOnTimeAlarms(): Promise<void> {
  useNotifications.setState({ lateAlarms: await allowExactAlarms().catch(checkLateAlarms) });
}

async function rememberAsked(): Promise<void> {
  useNotifications.setState({ asked: true });
  await storage.write(STORAGE_KEY, { asked: true });
}

/** Asks the system; once it allows them, both kinds are on (spec §3.11). */
export async function enableNotifications(): Promise<Permission> {
  const permission = await askNotificationPermission().catch((): Permission => 'denied');
  useNotifications.setState({ permission });
  await rememberAsked();
  if (permission === 'granted') {
    await changePreference('notify_rest_timer', true);
    await changePreference('notify_weekly_reminder', true);
  }
  return permission;
}

/** "Not now": the app does not ask again by itself; Settings can still turn them on. */
export async function declineNotifications(): Promise<void> {
  await rememberAsked();
}
