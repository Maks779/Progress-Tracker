import { useNavigation, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { openProfilePage, type ProfileHref } from '@/features/navigation/openProfilePage';
import { SyncStatus } from '@/features/outbox/components/SyncStatus';
import { QuickActions } from '@/features/quicklog/components/QuickActions';
import { UpNextCard } from '@/features/workout/components/UpNextCard';
import { WorkoutButton } from '@/features/workout/components/WorkoutButton';
import { useWorkoutEntry } from '@/features/workout/start';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { useHome } from '@/shared/api/generated/endpoints/stats/stats';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import { toIsoDate } from '@/shared/format/dates';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { Columns } from '@/shared/ui/Columns';
import { Screen } from '@/shared/ui/Screen';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';

import { HomeEmpty, NextGoalCard, RecentSessions, WeeklyRhythm } from './components/cards';
import { RingCard, SetGoalCard, type WeekStat, WeekStats } from './components/RingCard';
import { useHomeText } from './format';
import { activeDays, firstName, nextGoal, pagesTarget, ringFor, weekDates } from './rules';

/**
 * Home, the week at a glance (design: Home / Today): the ring with the main tracker's weekly
 * goal and streak and Start workout (Resume workout while one is under way), the recent
 * sessions, the unmet goal closest to done and, on tablets and desktop, the week's totals, its
 * rhythm and the workout up next in a side column. Offline, or with changes still waiting on
 * the device, the sync status leads the page. "Log reading" and "Other" under the ring open the
 * quick logs; "See all" comes with History.
 */
export function HomeScreen() {
  const { t, i18n } = useTranslation();
  const wide = useBreakpoint() !== 'compact';
  const pathname = usePathname();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const text = useHomeText();
  const me = useReadMe();
  const home = useHome();
  const trackers = useListTrackers({ include_archived: true });
  const goals = useListGoals();
  const account = me.data?.status === 200 ? me.data.data : undefined;
  const stats = home.data?.status === 200 ? home.data.data : undefined;
  const trackerItems = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
  const goalItems = goals.data?.status === 200 ? goals.data.data.items : undefined;
  const today = toIsoDate(new Date());
  const open = (href: ProfileHref) => openProfilePage(href, pathname, () => navigation.navigate('profile'));
  const entry = useWorkoutEntry(() => navigation.navigate('(home)'));

  const title = account ? t('home.greeting', { name: firstName(account.name) }) : t('home.title');
  const caption = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  const sync = <SyncStatus />;
  let body;
  if (home.isPending || trackers.isPending || goals.isPending) {
    body = (
      <>
        {sync}
        <SkeletonCard label={t('home.loading')} rows={3} />
      </>
    );
  } else if (!stats || !trackerItems || !goalItems) {
    body = (
      <>
        {sync}
        <ErrorCard
          title={t('home.loadErrorTitle')}
          message={t('home.loadError')}
          retryLabel={t('home.retry')}
          onRetry={() => {
            home.refetch();
            trackers.refetch();
            goals.refetch();
          }}
        />
      </>
    );
  } else {
    const ring = ringFor(stats.main_tracker_id, goalItems, trackerItems);
    if (ring.kind === 'none') {
      body = (
        <>
          {sync}
          <HomeEmpty onCreate={() => open('/profile/trackers/new')} />
        </>
      );
    } else {
      const active = trackerItems.filter((tracker) => !tracker.archived);
      const weekStats: WeekStat[] = [
        {
          label: t('home.stats.active'),
          value: text.number(Math.round(stats.active_time_s / 60)),
          unit: t('home.stats.activeUnit', { count: Math.round(stats.active_time_s / 60) }),
        },
      ];
      if (active.some((tracker) => tracker.type === 'strength')) {
        weekStats.push({
          label: t('home.stats.volume'),
          value: text.weightValue(stats.volume_kg),
          unit: t('home.stats.volumeUnit', { unit: t(`profile.units.${text.weightUnit}`) }),
        });
      }
      if (active.some((tracker) => tracker.type === 'reading')) {
        const target = pagesTarget(goalItems, trackerItems);
        weekStats.push({
          label: t('home.stats.pages'),
          value: text.number(stats.pages_read),
          unit:
            target === undefined
              ? t('home.stats.pagesUnit', { count: stats.pages_read })
              : t('home.stats.pagesOf', { target: text.number(target) }),
        });
      }
      const next = nextGoal(goalItems, trackerItems, ring.kind === 'goal' ? ring.goal.id : undefined);
      const main = (
        <>
          {sync}
          {ring.kind === 'goal' ? (
            <RingCard goal={ring.goal} tracker={ring.tracker} wide={wide}>
              <WorkoutButton entry={entry} />
              {wide ? <WeekStats stats={weekStats} /> : null}
            </RingCard>
          ) : (
            <SetGoalCard
              tracker={ring.tracker}
              onSetGoal={() => open(`/profile/goals/new?tracker=${ring.tracker.id}&from=home`)}
            >
              <WorkoutButton entry={entry} variant="secondary" />
            </SetGoalCard>
          )}
          <QuickActions trackers={trackerItems} showTab={(tab) => navigation.navigate(tab)} />
          <RecentSessions
            items={stats.recent_sessions}
            trackers={new Map(trackerItems.map((tracker) => [tracker.id, tracker]))}
            today={today}
          />
        </>
      );
      const side = (
        <>
          {next ? <NextGoalCard next={next} /> : null}
          {wide ? (
            <WeeklyRhythm dates={weekDates(stats.week_start)} active={activeDays(stats.week_days, ring.tracker.id)} />
          ) : null}
          {wide && stats.up_next && !entry.active ? <UpNextCard upNext={stats.up_next} entry={entry} /> : null}
        </>
      );
      body = <Columns tablet main={main} side={side} />;
    }
  }

  return (
    <Screen title={title} caption={caption} offlineBadge={false}>
      {body}
    </Screen>
  );
}
