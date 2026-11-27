import { router, useNavigation } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { openChooser } from '@/features/quicklog/chooser';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { TrackerSummary } from '@/shared/api/generated/model';
import { toIsoDate } from '@/shared/format/dates';
import { useNow } from '@/shared/hooks/useNow';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Columns } from '@/shared/ui/Columns';
import { SlidersHorizontal } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';
import { Screen } from '@/shared/ui/Screen';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';

import { HistoryEmpty, MonthReview, WeekList } from '../components/cards';
import { MonthCalendar } from '../components/MonthCalendar';
import { TrackerFilter, TrackerFilterSheet } from '../components/TrackerFilter';
import { useHasSessions, useMonth, useWeekSessions } from '../data';
import { monthOf, shiftMonth, type TrackerType, weekOf } from '../rules';

/**
 * History (design: History / Month): the tracker filter, the month with a marker per tracker
 * type on each day, and the chosen day's week with its sessions; "Month in review" beside them
 * on tablets and desktop. Before the first session it invites one. Offline it shows what was
 * saved on the device.
 */
export function HistoryScreen() {
  const { t } = useTranslation();
  const { space } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const today = toIsoDate(new Date(useNow(60_000)));
  const [trackerId, setTrackerId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => monthOf(today));
  const [selected, setSelected] = useState(today);
  const [filtering, setFiltering] = useState(false);
  const trackers = useListTrackers({ include_archived: true });
  const hasSessions = useHasSessions();
  const calendar = useMonth(month, trackerId);
  const week = weekOf(selected);
  const sessions = useWeekSessions(week, trackerId);
  const items = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
  const byId = useMemo(() => new Map<string, TrackerSummary>((items ?? []).map((tracker) => [tracker.id, tracker])), [items]);
  const monthData = calendar.data?.status === 200 ? calendar.data.data : undefined;
  const days = useMemo(
    () => new Map((monthData?.days ?? []).map((day) => [day.local_date, day.tracker_types as TrackerType[]])),
    [monthData],
  );
  const open = (id: string) => router.push(`/history/${id}`);
  const chosen = trackerId ? byId.get(trackerId) : undefined;

  let body;
  if (!items && trackers.isPending) {
    body = <SkeletonCard label={t('history.loading')} rows={3} />;
  } else if (!items) {
    body = (
      <ErrorCard title={t('history.loadErrorTitle')} message={t('history.loadError')} retryLabel={t('history.retry')} onRetry={() => trackers.refetch()} />
    );
  } else if (hasSessions === false) {
    body = <HistoryEmpty onLog={() => openChooser((tab) => navigation.navigate(tab))} />;
  } else {
    const list = (
      <WeekList
        week={week}
        today={today}
        items={sessions.items}
        trackers={byId}
        trackerName={chosen?.name}
        loading={sessions.query.isPending}
        failed={sessions.query.isError && sessions.items === undefined}
        more={sessions.query.hasNextPage}
        loadingMore={sessions.query.isFetchingNextPage}
        onMore={() => void sessions.query.fetchNextPage()}
        onRetry={() => void sessions.query.refetch()}
        onOpen={open}
      />
    );
    body = (
      <View style={{ gap: space[24] }}>
        {items.length > 1 ? <TrackerFilter trackers={items} value={trackerId} onChange={setTrackerId} onMore={() => setFiltering(true)} /> : null}
        <Columns
          tablet
          main={
            <MonthCalendar
              month={month}
              today={today}
              selected={selected}
              days={days}
              onMonth={(by) => setMonth((current) => shiftMonth(current, by))}
              onSelect={setSelected}
            />
          }
          side={
            <>
              {list}
              {wide ? <MonthReview month={monthData} /> : null}
            </>
          }
        />
      </View>
    );
  }

  return (
    <>
      <Screen
        title={t('history.title')}
        caption={t('history.caption')}
        action={items && items.length > 1 ? <IconButton icon={SlidersHorizontal} label={t('history.filter.open')} onPress={() => setFiltering(true)} /> : undefined}
      >
        {body}
      </Screen>
      {filtering && items ? (
        <TrackerFilterSheet trackers={items} value={trackerId} onChange={setTrackerId} onClose={() => setFiltering(false)} />
      ) : null}
    </>
  );
}
