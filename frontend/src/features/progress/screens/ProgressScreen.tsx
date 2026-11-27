import { router, useNavigation } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { TrackerFilterSheet } from '@/features/history/components/TrackerFilter';
import { openChooser } from '@/features/quicklog/chooser';
import { useExerciseCatalog } from '@/features/workout/exercises';
import { usePreferences } from '@/features/settings/preferences';
import { useWorkoutEntry } from '@/features/workout/start';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useListSessions } from '@/shared/api/generated/endpoints/sessions/sessions';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { GoalOut } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';
import { useNow } from '@/shared/hooks/useNow';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { controlHeight } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/Button';
import { Columns } from '@/shared/ui/Columns';
import { showFocusRing } from '@/shared/ui/focusRing';
import { ChevronDown, SlidersHorizontal } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';
import { Screen } from '@/shared/ui/Screen';
import { Segmented } from '@/shared/ui/Segmented';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';

import { BarsCard, ConsistencyCard, ExerciseLineCard, ExerciseSheet, ProgressEmpty, TotalsCard } from '../components/cards';
import { useExerciseLine, useOverview } from '../data';
import { doneExercises, type Period, PERIODS } from '../rules';

/** The tab between Overview and Records (design: the segmented control under the title). */
export function ProgressTabs({ value }: { value: 'overview' | 'records' }) {
  const { t } = useTranslation();
  return (
    <Segmented
      label={t('progress.tabs.label')}
      value={value}
      onChange={(next) => (next === 'records' ? router.push('/progress/records') : router.dismissTo('/progress'))}
      options={[
        { value: 'overview', label: t('progress.tabs.overview') },
        { value: 'records', label: t('progress.tabs.records') },
      ]}
    />
  );
}

/** The streak the consistency card speaks of: the pinned weekly goal with the longest streak. */
function streakGoal(goals: GoalOut[]): GoalOut | undefined {
  return goals
    .filter((goal) => goal.is_pinned && goal.period === 'week')
    .sort((a, b) => (b.streak_weeks ?? 0) - (a.streak_weeks ?? 0))[0];
}

/**
 * Progress (design: Progress / Overview): the period and the tracker, the line of one
 * exercise, volume and pages by week or month, the consistency grid and the totals; "View
 * personal records" on tablets and desktop. Before a second session it invites one. Offline it
 * shows what was saved on the device.
 */
export function ProgressScreen() {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const today = toIsoDate(new Date(useNow(60_000)));
  const [period, setPeriod] = useState<Period>('4w');
  const [trackerId, setTrackerId] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<string | undefined>();
  const [sheet, setSheet] = useState<'trackers' | 'exercises' | null>(null);
  const weightUnit = usePreferences((state) => state.values.weight_unit);
  const trackers = useListTrackers({ include_archived: true });
  const goals = useListGoals();
  const catalog = useExerciseCatalog();
  const sessions = useListSessions({ limit: 2 });
  const overview = useOverview(period, trackerId);
  const items = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
  const chosen = items?.find((tracker) => tracker.id === trackerId);
  const done = doneExercises(catalog.items ?? []);
  const exercise = done.find((item) => item.id === exerciseId) ?? done[0];
  const line = useExerciseLine(exercise?.id, period);
  const entry = useWorkoutEntry(() => navigation.navigate('(home)'));
  const stats = overview.data?.status === 200 ? overview.data.data : undefined;
  const lineData = line.data?.status === 200 ? line.data.data : undefined;
  const fewSessions = sessions.data?.status === 200 && sessions.data.data.items.length < 2;
  const hasType = (type: string) => (items ?? []).some((tracker) => tracker.type === type) && (!chosen || chosen.type === type);
  const showStrength = hasType('strength');
  const showReading = hasType('reading');

  let body;
  if (!items && trackers.isPending) {
    body = <SkeletonCard label={t('progress.loading')} rows={3} />;
  } else if (!items || (!stats && overview.isError)) {
    body = (
      <ErrorCard
        title={t('progress.loadErrorTitle')}
        message={t('progress.loadError')}
        retryLabel={t('progress.retry')}
        onRetry={() => {
          void trackers.refetch();
          void overview.refetch();
        }}
      />
    );
  } else if (fewSessions) {
    body = entry.available ? (
      <ProgressEmpty action={t('progress.empty.workout')} onAction={() => entry.open()} />
    ) : (
      <ProgressEmpty action={t('progress.empty.log')} onAction={() => openChooser((tab) => navigation.navigate(tab))} />
    );
  } else if (!stats) {
    body = <SkeletonCard label={t('progress.loading')} rows={3} />;
  } else {
    const bars = (
      <View style={{ flexDirection: 'row', gap: wide ? space[24] : space[16] }}>
        {showStrength ? (
          <BarsCard title={t('progress.volume', { unit: t(`profile.units.${weightUnit}`) })} stats={stats} kind="volume" empty={t('progress.noVolume')} />
        ) : null}
        {showReading ? (
          <BarsCard title={t(`progress.pages.${stats.bucket}`)} stats={stats} kind="pages" empty={t('progress.noPages')} />
        ) : null}
      </View>
    );
    body = (
      <Columns
        tablet
        main={
          <>
            {showStrength && exercise ? (
              <ExerciseLineCard
                exercise={exercise}
                points={lineData?.points}
                change={lineData?.change_kg}
                period={period}
                loading={line.isPending}
                onPick={() => setSheet('exercises')}
              />
            ) : null}
            {showStrength || showReading ? bars : null}
          </>
        }
        side={
          <>
            <ConsistencyCard stats={stats} period={period} today={today} goal={streakGoal(goals.data?.status === 200 ? goals.data.data.items : [])} />
            <TotalsCard stats={stats} period={period} volume={showStrength} pages={showReading} />
            {wide ? <Button label={t('progress.viewRecords')} variant="secondary" onPress={() => router.push('/progress/records')} /> : null}
          </>
        }
      />
    );
  }

  const filterButton = (
    <Pressable
      role="button"
      aria-label={`${t('progress.filter')}: ${chosen?.name ?? t('history.filter.all')}`}
      onPress={() => setSheet('trackers')}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: controlHeight.compact,
        paddingHorizontal: space[16],
        borderRadius: radius[12],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: hovered ? colors.bg.surfaceRaised : colors.bg.surface,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Text variant="smallStrong" numberOfLines={1}>
        {chosen?.name ?? t('history.filter.all')}
      </Text>
      <ChevronDown color={colors.text.primary} size={16} strokeWidth={2} />
    </Pressable>
  );

  return (
    <>
      <Screen
        title={t('progress.title')}
        caption={t('progress.caption')}
        action={items && items.length > 1 ? <IconButton icon={SlidersHorizontal} label={t('progress.filter')} onPress={() => setSheet('trackers')} /> : undefined}
      >
        <View style={{ gap: wide ? space[24] : space[16] }}>
          <ProgressTabs value="overview" />
          {items && !fewSessions ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[16] }}>
              <View style={{ flex: 1 }}>
                <Segmented
                  label={t('progress.period.label')}
                  value={period}
                  onChange={setPeriod}
                  options={PERIODS.map((value) => ({ value, label: t(`progress.period.${value}`) }))}
                />
              </View>
              {wide && items.length > 1 ? filterButton : null}
            </View>
          ) : null}
          {body}
        </View>
      </Screen>
      {sheet === 'trackers' && items ? (
        <TrackerFilterSheet trackers={items} value={trackerId} onChange={setTrackerId} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'exercises' ? (
        <ExerciseSheet
          exercises={done}
          selected={exercise?.id}
          onPick={(id) => {
            setExerciseId(id);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </>
  );
}
