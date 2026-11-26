import { useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useGoalText } from '@/features/goals/format';
import { headlineGoal } from '@/features/goals/rules';
import { WorkoutButton } from '@/features/workout/components/WorkoutButton';
import { useWorkoutEntry } from '@/features/workout/start';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { TrackerSummary } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { Screen } from '@/shared/ui/Screen';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';

import { FeatureCard, TrackerRow } from '../components/display';

/**
 * Every tracker with its type, number of sessions and headline goal ("Strength · 18 sessions ·
 * 3 / week"), then the archived ones. The side card shows the main tracker and Start workout.
 */
export function TrackersScreen() {
  const { t } = useTranslation();
  const { space } = useTheme();
  const router = useRouter();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const entry = useWorkoutEntry(() => navigation.navigate('(home)'));
  const back = () => router.dismissTo('/profile');
  const goalText = useGoalText();
  const trackers = useListTrackers({ include_archived: true });
  const goals = useListGoals();
  const me = useReadMe();
  const items = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
  const goalItems = goals.data?.status === 200 ? goals.data.data.items : [];
  const mainId = me.data?.status === 200 ? me.data.data.main_tracker_id : null;
  const active = items?.filter((tracker) => !tracker.archived) ?? [];
  const archived = items?.filter((tracker) => tracker.archived) ?? [];
  const main = active.find((tracker) => tracker.id === mainId);

  function detail(tracker: TrackerSummary): string {
    const parts = [t(`trackers.types.${tracker.type}`), t('sessions', { count: tracker.session_count })];
    const goal = headlineGoal(goalItems, tracker.id);
    if (goal && !tracker.archived) {
      parts.push(goalText.short(goal, tracker));
    }
    return parts.join(' · ');
  }

  const open = (tracker: TrackerSummary) =>
    router.push({ pathname: '/profile/trackers/[id]', params: { id: tracker.id } });
  const create = () => router.push('/profile/trackers/new');

  let list;
  if (trackers.isPending) {
    list = <SkeletonCard label={t('trackers.loading')} rows={4} />;
  } else if (!items) {
    list = <ErrorCard message={t('trackers.loadError')} retryLabel={t('trackers.retry')} onRetry={() => trackers.refetch()} />;
  } else {
    list = (
      <>
        <Card style={{ gap: space[8], padding: space[24] }}>
          {active.length === 0 ? (
            <Text tone="muted" style={{ paddingBottom: space[8] }}>
              {t('trackers.empty')}
            </Text>
          ) : (
            active.map((tracker) => (
              <TrackerRow
                key={tracker.id}
                icon={tracker.icon}
                color={tracker.color}
                name={tracker.name}
                detail={detail(tracker)}
                onPress={() => open(tracker)}
              />
            ))
          )}
          <Button label={t('trackers.create')} onPress={create} />
        </Card>
        {archived.length > 0 ? (
          <Card style={{ gap: space[8], padding: space[24] }}>
            <Text variant="h3" accessibilityRole="header">
              {t('trackers.archived')}
            </Text>
            {archived.map((tracker) => (
              <TrackerRow
                key={tracker.id}
                icon={tracker.icon}
                color={tracker.color}
                name={tracker.name}
                detail={detail(tracker)}
                muted
                onPress={() => open(tracker)}
              />
            ))}
          </Card>
        ) : null}
      </>
    );
  }

  return (
    <Screen title={t('trackers.title')} caption={t('trackers.caption')} back={{ label: t('tabs.profile'), onPress: back }}>
      <Columns
        main={list}
        side={
          <FeatureCard
            eyebrow={t('trackers.space.eyebrow')}
            icon={main?.icon}
            color={main?.color}
            name={main?.name}
            body={t('trackers.space.body')}
          >
            <WorkoutButton entry={entry} />
          </FeatureCard>
        }
      />
    </Screen>
  );
}
