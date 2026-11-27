import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useExerciseCatalog } from '@/features/workout/exercises';
import { CACHE_GC_TIME } from '@/shared/api/cache';
import { useOffline } from '@/shared/api/connection';
import { ApiError } from '@/shared/api/fetcher';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useGetSession } from '@/shared/api/generated/endpoints/sessions/sessions';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { GoalOut, SessionOut, TrackerSummary } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { Notice } from '@/shared/ui/Notice';
import { Screen } from '@/shared/ui/Screen';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';
import { showToast } from '@/shared/ui/Toast';

import { ExerciseList, NoteCard, SessionStats, WeekGoalCard } from '../components/detail';
import { removeSession, restoreRemoved, useSessionTitle } from '../data';
import { useHistoryText } from '../format';
import { inWeek, weekOf } from '../rules';

function backToHistory() {
  router.dismissTo('/history');
}

/** The tracker's weekly goal this session counts toward: its frequency goal, else a weekly amount. */
function weeklyGoal(goals: GoalOut[], trackerId: string): GoalOut | undefined {
  const own = goals.filter((goal) => goal.tracker_id === trackerId && goal.period === 'week' && goal.kind !== 'cumulative');
  return own.find((goal) => goal.kind === 'frequency') ?? own[0];
}

/**
 * A session (design: History / Session detail): its numbers, a workout's exercises and sets,
 * the note, Edit session and Delete. Delete takes it away at once and offers Undo (decision
 * #14). Editing and deleting need a connection; offline the saved copy is shown.
 */
export function SessionScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useGetSession(id ?? '', { query: { enabled: Boolean(id), gcTime: CACHE_GC_TIME } });
  const trackers = useListTrackers({ include_archived: true });
  const data = session.data?.status === 200 ? session.data.data : undefined;
  const title = useSessionTitle(data);
  const text = useHistoryText();
  const missing = session.error instanceof ApiError && session.error.status === 404;

  let body;
  if (data) {
    const tracker = trackers.data?.status === 200 ? trackers.data.data.items.find((item) => item.id === data.tracker_id) : undefined;
    body = <SessionDetail session={data} tracker={tracker} />;
  } else if (session.isPending) {
    body = <SkeletonCard label={t('history.detail.loading')} rows={3} />;
  } else if (missing) {
    body = (
      <Card style={{ gap: 16 }}>
        <Text variant="small" tone="muted">
          {t('history.detail.missing')}
        </Text>
        <Button label={t('history.detail.back')} variant="secondary" onPress={backToHistory} />
      </Card>
    );
  } else {
    body = (
      <ErrorCard
        title={t('history.detail.errorTitle')}
        message={t('history.loadError')}
        retryLabel={t('history.retry')}
        onRetry={() => session.refetch()}
      />
    );
  }

  return (
    <Screen
      title={data ? title : t('nav.session')}
      caption={data ? text.startedCaption(data.started_at) : undefined}
      back={{ label: t('tabs.history'), onPress: backToHistory }}
    >
      {body}
    </Screen>
  );
}

function SessionDetail({ session, tracker }: { session: SessionOut; tracker: TrackerSummary | undefined }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const client = useQueryClient();
  const wide = useBreakpoint() !== 'compact';
  const offline = useOffline();
  const catalog = useExerciseCatalog();
  const goals = useListGoals();
  const [error, setError] = useState<string | null>(null);
  const goal = tracker && goals.data?.status === 200 ? weeklyGoal(goals.data.data.items, tracker.id) : undefined;
  const thisWeek = inWeek(session.local_date, weekOf(toIsoDate(new Date())));

  const remove = async () => {
    setError(null);
    const failure = await removeSession(client, session.id);
    if (failure) {
      setError(t(failure === 'offline' ? 'history.detail.offline' : 'history.detail.deleteFailed'));
      return;
    }
    backToHistory();
    showToast(t('history.detail.removed'), {
      label: t('history.detail.undo'),
      onPress: () => {
        void restoreRemoved(client, session.id).then((result) => {
          const key = result === 'restored' ? 'restored' : result === 'conflict' ? 'restoreConflict' : 'restoreFailed';
          showToast(t(`history.detail.${key}`));
        });
      },
    });
  };

  const actions = (
    <View style={{ gap: space[16] }}>
      {offline ? <Notice tone="info" title={t('history.detail.offline')} /> : null}
      {error ? <Notice tone="error" title={error} /> : null}
      <View style={{ flexDirection: 'row', gap: space[16] }}>
        <View style={{ flex: 1 }}>
          <Button
            label={t('history.detail.edit')}
            variant="secondary"
            disabled={offline}
            onPress={() => router.push(`/history/${session.id}/edit`)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t('history.detail.delete')} variant="secondary" disabled={offline} onPress={remove} />
        </View>
      </View>
    </View>
  );

  const main = (
    <>
      <SessionStats session={session} tracker={tracker} />
      {session.strength ? <ExerciseList session={session} catalog={catalog.byId} /> : null}
      {!wide && session.note ? <NoteCard note={session.note} /> : null}
      {!wide ? actions : null}
    </>
  );
  const side = wide ? (
    <>
      {session.note ? <NoteCard note={session.note} /> : null}
      {actions}
      {goal && tracker && thisWeek ? <WeekGoalCard goal={goal} tracker={tracker} /> : null}
    </>
  ) : undefined;
  return <Columns main={main} side={side} />;
}
