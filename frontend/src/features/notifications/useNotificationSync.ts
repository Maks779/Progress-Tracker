import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { useAuthStore } from '@/features/auth/store';
import { usePreferences } from '@/features/settings/preferences';
import { useActiveDraft } from '@/features/workout/start';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import {
  cancelAllNotifications,
  cancelNotification,
  NOTIFICATIONS_AVAILABLE,
  scheduleNotification,
  setUpNotifications,
} from '@/shared/notifications/notifications';

import { nextReminderTime, reminderGoals, restAlarm } from './rules';
import { refreshPermission, useNotifications } from './store';

/**
 * Keeps the scheduled notifications in step with the app (spec §3.11), on Android and iOS:
 * the rest notification follows the workout's rest (set, extended, skipped, ended with Finish
 * or Discard); the weekly reminder is planned again whenever the goals change, so a session that
 * meets them takes it away. Both need the toggle and the system's permission, and both are set
 * again once Android allows exact alarms, so they come on time. Signing out takes every
 * notification away.
 */
export function useNotificationSync(): void {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const permission = useNotifications((state) => state.permission);
  const lateAlarms = useNotifications((state) => state.lateAlarms);
  const restOn = usePreferences((state) => state.values.notify_rest_timer);
  const weeklyOn = usePreferences((state) => state.values.notify_weekly_reminder);
  const draft = useActiveDraft();
  const signedIn = status === 'signedIn';
  const goals = useListGoals(undefined, { query: { enabled: signedIn && NOTIFICATIONS_AVAILABLE } });
  const trackers = useListTrackers({ include_archived: true }, { query: { enabled: signedIn && NOTIFICATIONS_AVAILABLE } });
  const allowed = NOTIFICATIONS_AVAILABLE && signedIn && permission === 'granted';
  const endsAt = draft?.rest?.endsAt;
  const workoutName = draft?.name;
  const goalItems = goals.data?.status === 200 ? goals.data.data.items : undefined;
  const trackerItems = trackers.data?.status === 200 ? trackers.data.data.items : undefined;

  useEffect(() => {
    void setUpNotifications(t('notifications.channel'));
  }, [t]);

  useEffect(() => {
    if (!NOTIFICATIONS_AVAILABLE) {
      return undefined;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshPermission();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (status === 'signedOut') {
      void cancelAllNotifications();
    }
  }, [status]);

  useEffect(() => {
    if (!NOTIFICATIONS_AVAILABLE) {
      return;
    }
    const at = allowed && restOn ? restAlarm(endsAt === undefined ? null : { endsAt, seconds: 0 }, Date.now()) : null;
    if (at) {
      void scheduleNotification('rest', at, { title: t('notifications.rest.title'), body: t('notifications.rest.body', { name: workoutName }) });
    } else {
      void cancelNotification('rest');
    }
  }, [allowed, restOn, endsAt, workoutName, lateAlarms, t]);

  useEffect(() => {
    if (!NOTIFICATIONS_AVAILABLE || (allowed && weeklyOn && (!goalItems || !trackerItems))) {
      return;
    }
    const now = new Date();
    const at = nextReminderTime(now);
    const named = allowed && weeklyOn && goalItems && trackerItems ? reminderGoals(goalItems, trackerItems, at, now) : [];
    if (named.length === 0) {
      void cancelNotification('weekly');
      return;
    }
    const [first, second] = named;
    const names =
      named.length === 1
        ? first.name
        : named.length === 2
          ? t('notifications.weekly.two', { first: first.name, second: second.name })
          : t('notifications.weekly.more', { first: first.name, second: second.name, extra: named.length - 2 });
    void scheduleNotification('weekly', at, { title: t('notifications.weekly.title'), body: t('notifications.weekly.body', { names }) });
  }, [allowed, weeklyOn, goalItems, trackerItems, lateAlarms, t]);
}
