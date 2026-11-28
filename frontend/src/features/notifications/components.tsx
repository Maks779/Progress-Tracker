import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { changePreference, usePreferences } from '@/features/settings/preferences';
import { NOTIFICATIONS_AVAILABLE } from '@/shared/notifications/notifications';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Bell } from '@/shared/ui/icons';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { TextLink } from '@/shared/ui/TextLink';
import { Toggle } from '@/shared/ui/Toggle';

import { allowOnTimeAlarms, declineNotifications, enableNotifications, useNotifications } from './store';

type Kind = 'notify_rest_timer' | 'notify_weekly_reminder';

function ToggleRow({ kind, title, hint }: { kind: Kind; title: string; hint: string }) {
  const { space } = useTheme();
  const wanted = usePreferences((state) => state.values[kind]);
  const permission = useNotifications((state) => state.permission);
  const on = wanted && permission === 'granted';
  const change = async (next: boolean) => {
    if (!next) {
      await changePreference(kind, false);
      return;
    }
    if (permission === 'granted' || (await enableNotifications()) === 'granted') {
      await changePreference(kind, true);
    }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[16], minHeight: 56 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="small">{title}</Text>
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      </View>
      <Toggle label={title} value={on} onChange={(next) => void change(next)} />
    </View>
  );
}

function CardNote({ text, link, onPress }: { text: string; link: string; onPress: () => void }) {
  const { colors, space } = useTheme();
  return (
    <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: space[16], marginTop: space[8] }}>
      <Text variant="caption" tone="muted">
        {text}
      </Text>
      <TextLink label={link} onPress={onPress} align="start" />
    </View>
  );
}

/**
 * Notifications in Settings (decision #8, §7.2): rest-timer alerts and the weekly reminder, each
 * with its toggle. Turning one on asks the system when it has not been asked yet; when the phone
 * blocks Ember, the card says so and opens the phone's settings. When Android would deliver rest
 * alerts late, it offers "Alarms & reminders". Phones only: the web has none.
 */
export function NotificationsCard() {
  const { t } = useTranslation();
  const { space } = useTheme();
  const { permission, lateAlarms } = useNotifications();
  const restOn = usePreferences((state) => state.values.notify_rest_timer);
  if (!NOTIFICATIONS_AVAILABLE) {
    return null;
  }
  return (
    <Card style={{ gap: space[8], paddingVertical: space[16] }}>
      <Text variant="smallStrong" accessibilityRole="header">
        {t('notifications.settings.title')}
      </Text>
      <ToggleRow kind="notify_rest_timer" title={t('notifications.settings.rest')} hint={t('notifications.settings.restHint')} />
      <ToggleRow kind="notify_weekly_reminder" title={t('notifications.settings.weekly')} hint={t('notifications.settings.weeklyHint')} />
      {permission === 'denied' ? (
        <CardNote text={t('notifications.settings.blocked')} link={t('notifications.settings.openSettings')} onPress={() => void Linking.openSettings()} />
      ) : permission === 'granted' && restOn && lateAlarms ? (
        <CardNote text={t('notifications.settings.late')} link={t('notifications.settings.allowAlarms')} onPress={() => void allowOnTimeAlarms()} />
      ) : null}
    </Card>
  );
}

/**
 * "A nudge, on your terms." (design: System / Notification permission): asked once, in context,
 * the first time a rest timer starts (spec §3.11). Enable asks the system; Not now leaves it to
 * Settings.
 */
export function NotificationAskSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Sheet visible title={t('notifications.ask.title')} onClose={() => void declineNotifications().then(onClose)}>
      <Bell color={colors.accent.text} size={24} strokeWidth={1.75} />
      <Text variant="small" tone="muted">
        {t('notifications.ask.body')}
      </Text>
      <Button label={t('notifications.ask.enable')} onPress={() => enableNotifications().then(onClose)} />
      <Button label={t('notifications.ask.later')} variant="ghost" onPress={() => declineNotifications().then(onClose)} />
    </Sheet>
  );
}

/** Whether the first rest of this device should ask (spec §3.11): never asked, nothing decided yet, on a phone. */
export function useAskOnRest(resting: boolean): boolean {
  const { hydrated, asked, permission } = useNotifications();
  return NOTIFICATIONS_AVAILABLE && resting && hydrated && !asked && permission === 'undetermined';
}
