import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAccountId } from '@/features/auth/account';
import { useOffline } from '@/shared/api/connection';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { CircleAlert, CloudOff, TriangleAlert, WifiOff } from '@/shared/ui/icons';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { TextLink } from '@/shared/ui/TextLink';

import { flushOutbox, itemKey, removeItem, retryItem, useOutbox } from '../outbox';
import type { OutboxItem } from '../rules';

function WaitingBadge({ count }: { count: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return <Badge icon={CloudOff} color={colors.accent.text} label={t('sync.waiting', { count })} />;
}

/** "You're offline." (design: System / Offline): logging goes on, and what waits on the device. */
function OfflineCard({ sessions, changes }: { sessions: number; changes: number }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <WifiOff color={colors.state.warning} size={24} strokeWidth={1.75} />
      <Text variant="h3" style={{ marginTop: space[8] }}>
        {t('sync.offlineTitle')}
      </Text>
      <Text variant="small" tone="muted">
        {sessions > 0 ? t('sync.offlineBody', { count: sessions }) : t('sync.offlineBodyNone')}
      </Text>
      {changes > 0 ? (
        <View style={{ alignItems: 'flex-start', marginTop: 2 }}>
          <WaitingBadge count={changes} />
        </View>
      ) : null}
    </Card>
  );
}

/** Online, with changes still on their way (or waiting for the server to answer again). */
function WaitingCard({ count, syncing, onSync }: { count: number; syncing: boolean; onSync: () => void }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[8] }}>
      <View style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-start' }}>
          <WaitingBadge count={count} />
        </View>
      </View>
      {syncing ? (
        <Text variant="small" tone="muted">
          {t('sync.syncing')}
        </Text>
      ) : (
        <TextLink label={t('sync.syncNow')} onPress={onSync} align="start" />
      )}
    </Card>
  );
}

function itemName(item: OutboxItem, fallback: string): string {
  return item.body.name?.trim() || fallback;
}

/** A change the server refused: why, Try again when that could help, and Remove (asks first). */
function FailedCard({ item }: { item: OutboxItem }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const name = itemName(item, t(item.kind === 'session' ? 'sync.aWorkout' : 'sync.anExercise'));
  const key = itemKey(item);
  const retryable = item.failure === 'refused';
  return (
    <Card role="alert" style={{ gap: space[8] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <CircleAlert color={colors.state.error} size={20} strokeWidth={1.75} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {t('sync.failedTitle', { name })}
        </Text>
      </View>
      <Text variant="small" tone="muted">
        {t(`sync.failed.${item.failure ?? 'refused'}`)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8], marginTop: space[4] }}>
        {retryable ? (
          <View style={{ flexGrow: 1 }}>
            <Button label={t('sync.retry')} variant="secondary" size="compact" onPress={() => retryItem(key)} />
          </View>
        ) : null}
        <View style={{ flexGrow: 1 }}>
          <Button label={t('sync.remove')} variant="secondary" size="compact" onPress={() => setConfirming(true)} />
        </View>
      </View>
      {confirming ? (
        <Sheet visible title={t('sync.removeTitle', { name })} onClose={() => setConfirming(false)}>
          <View style={{ flexDirection: 'row', gap: space[8] }}>
            <TriangleAlert color={colors.state.error} size={20} strokeWidth={1.75} />
            <Text variant="small" tone="muted" style={{ flex: 1 }}>
              {t('sync.removeBody')}
            </Text>
          </View>
          <Button label={t('sync.remove')} variant="destructive" onPress={() => removeItem(key)} />
          <Button label={t('sync.keep')} variant="secondary" onPress={() => setConfirming(false)} />
        </Sheet>
      ) : null}
    </Card>
  );
}

/**
 * The account's changes that have not reached the server, at the top of Home: "You're
 * offline." with how many wait on the device, the same count with Sync now when the device is
 * online again, and a card for each change the server refused.
 */
export function SyncStatus() {
  const accountId = useAccountId();
  const offline = useOffline();
  const items = useOutbox((state) => state.items);
  const syncing = useOutbox((state) => state.syncing);
  const mine = items.filter((item) => item.userId === accountId);
  const pending = mine.filter((item) => item.failure === null);
  const failed = mine.filter((item) => item.failure !== null);
  const sessions = pending.filter((item) => item.kind === 'session').length;
  if (!offline && mine.length === 0) {
    return null;
  }
  let status = null;
  if (offline) {
    status = <OfflineCard sessions={sessions} changes={pending.length} />;
  } else if (pending.length > 0 && accountId) {
    status = <WaitingCard count={pending.length} syncing={syncing} onSync={() => void flushOutbox(accountId)} />;
  }
  return (
    <>
      {status}
      {failed.map((item) => (
        <FailedCard key={itemKey(item)} item={item} />
      ))}
    </>
  );
}
