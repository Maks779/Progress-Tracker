import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { IconButton } from '@/shared/ui/IconButton';
import { Plus } from '@/shared/ui/icons';
import { Screen } from '@/shared/ui/Screen';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';

import { GoalCard, StreakCard } from '../components';
import { visibleGoals } from '../rules';

/**
 * Every goal of the active trackers, ordered like the trackers, the pinned one first. The
 * streak card follows the main tracker's pinned weekly goal.
 */
export function GoalsScreen() {
  const { t } = useTranslation();
  const { space } = useTheme();
  const router = useRouter();
  const back = () => router.dismissTo('/profile');
  const trackers = useListTrackers();
  const goals = useListGoals();
  const me = useReadMe();
  const trackerItems = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
  const goalItems = goals.data?.status === 200 ? goals.data.data.items : undefined;
  const mainId = me.data?.status === 200 ? me.data.data.main_tracker_id : null;
  const today = toIsoDate(new Date());
  const create = () => router.push('/profile/goals/new');

  let list;
  let mainGoal: GoalOut | undefined;
  let mainTracker: TrackerSummary | undefined;
  if (trackers.isPending || goals.isPending) {
    list = <SkeletonCard label={t('goals.loading')} rows={3} />;
  } else if (!trackerItems || !goalItems) {
    list = (
      <ErrorCard
        message={t('goals.loadError')}
        retryLabel={t('goals.retry')}
        onRetry={() => {
          trackers.refetch();
          goals.refetch();
        }}
      />
    );
  } else {
    const shown = visibleGoals(goalItems, trackerItems);
    const byId = new Map(trackerItems.map((tracker) => [tracker.id, tracker]));
    const weeklyCount = (trackerId: string) =>
      shown.filter((goal) => goal.tracker_id === trackerId && goal.period === 'week').length;
    mainTracker = mainId ? byId.get(mainId) : undefined;
    mainGoal = shown.find((goal) => goal.tracker_id === mainId && goal.is_pinned);
    list = (
      <>
        {shown.length === 0 ? (
          <Card style={{ padding: space[24] }}>
            <Text tone="muted">{t(trackerItems.length === 0 ? 'goals.noTrackers' : 'goals.empty')}</Text>
          </Card>
        ) : (
          shown.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              tracker={byId.get(goal.tracker_id)!}
              today={today}
              showPinned={weeklyCount(goal.tracker_id) > 1}
              onPress={() => router.push({ pathname: '/profile/goals/[id]', params: { id: goal.id } })}
            />
          ))
        )}
        {trackerItems.length === 0 ? (
          <Button label={t('goals.createTracker')} onPress={() => router.push('/profile/trackers/new')} />
        ) : (
          <Button label={t('goals.create')} variant="secondary" onPress={create} />
        )}
      </>
    );
  }

  return (
    <Screen
      title={t('goals.title')}
      caption={t('goals.caption')}
      back={{ label: t('tabs.profile'), onPress: back }}
      action={trackerItems && trackerItems.length > 0 ? <IconButton icon={Plus} label={t('goals.create')} onPress={create} /> : null}
    >
      <Columns main={list} side={<StreakCard goal={mainGoal} trackerName={mainTracker?.name} />} />
    </Screen>
  );
}
