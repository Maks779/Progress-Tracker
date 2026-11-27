import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAccountId } from '@/features/auth/account';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import { useNow } from '@/shared/hooks/useNow';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { X } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';
import { Screen } from '@/shared/ui/Screen';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';

import { QuickLogForm } from '../components/QuickLogForm';
import { useBooks, useLastSession } from '../data';
import { kindOf } from '../rules';

function close() {
  router.dismissTo('/');
}

/**
 * A quick log (design: Quick log / Cardio, Reading, General duration, General counter): the form
 * of the tracker's type, prefilled from its last session, saved in one tap, then back to Home
 * with "Saved". Offline the session waits in the outbox. The tracker comes from the route.
 */
export function QuickLogScreen() {
  const { t, i18n } = useTranslation();
  const { tracker: trackerId } = useLocalSearchParams<{ tracker: string }>();
  const trackers = useListTrackers({ include_archived: true });
  const goals = useListGoals();
  const accountId = useAccountId();
  const books = useBooks();
  const items = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
  const tracker = items?.find((item) => item.id === trackerId && !item.archived);
  const kind = tracker ? kindOf(tracker) : null;
  const last = useLastSession(tracker && kind ? tracker.id : undefined);
  const now = useNow(60_000);
  const caption = t('quickLog.caption', {
    date: new Intl.DateTimeFormat(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(now)),
  });
  let title = t('quickLog.title.default');
  if (tracker && kind) {
    title = kind === 'cardio' || kind === 'reading' ? t(`quickLog.title.${kind}`) : t('quickLog.title.general', { name: tracker.name });
  }

  let body;
  if (trackers.isPending) {
    body = <SkeletonCard label={t('quickLog.loading')} rows={3} />;
  } else if (!items) {
    body = <ErrorCard title={t('quickLog.loadErrorTitle')} message={t('quickLog.loadError')} retryLabel={t('home.retry')} onRetry={() => trackers.refetch()} />;
  } else if (!tracker || !kind) {
    body = (
      <Card style={{ gap: 16 }}>
        <Text variant="small" tone="muted">
          {t(tracker ? 'quickLog.notQuick' : 'quickLog.missing')}
        </Text>
        <Button label={t('quickLog.back')} variant="secondary" onPress={close} />
      </Card>
    );
  } else if (!last.ready || (kind === 'reading' && books.items === undefined && !books.query.isError)) {
    body = <SkeletonCard label={t('quickLog.loading')} rows={3} />;
  } else {
    body = (
      <QuickLogForm
        key={tracker.id}
        tracker={tracker}
        kind={kind}
        trackers={items.filter((item) => !item.archived && kindOf(item) !== null && kindOf(item) !== 'reading')}
        goals={goals.data?.status === 200 ? goals.data.data.items : []}
        books={books.items ?? []}
        accountId={accountId}
        mode={{ kind: 'new', last: last.last }}
      />
    );
  }

  return (
    <Screen title={title} caption={caption} action={<IconButton icon={X} label={t('quickLog.close')} onPress={close} />}>
      {body}
    </Screen>
  );
}
