import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { CalendarMonth, SessionListItem, TrackerSummary } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Sparkles } from '@/shared/ui/icons';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';

import { useHistoryText } from '../format';
import type { Week } from '../rules';
import { SessionRow } from './SessionRow';

type WeekProps = {
  week: Week;
  today: string;
  items: SessionListItem[] | undefined;
  trackers: Map<string, TrackerSummary>;
  /** The tracker the list is filtered by, for its empty line. */
  trackerName: string | undefined;
  loading: boolean;
  failed: boolean;
  more: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
  onOpen: (id: string) => void;
};

/**
 * The chosen day's week (design: "This week · 4 sessions", "October 19 – 25"): its sessions,
 * newest first, each opening its detail; Show more when the week has more than one page.
 */
export function WeekList({ week, today, items, trackers, trackerName, loading, failed, more, loadingMore, onMore, onRetry, onOpen }: WeekProps) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const text = useHistoryText();
  let body;
  if (items === undefined && loading) {
    body = <SkeletonCard label={t('history.week.loading')} rows={2} />;
  } else if (items === undefined || failed) {
    body = (
      <ErrorCard title={t('history.week.errorTitle')} message={t('history.loadError')} retryLabel={t('history.retry')} onRetry={onRetry} />
    );
  } else if (items.length === 0) {
    body = (
      <Card style={{ padding: space[24] }}>
        <Text variant="small" tone="muted">
          {trackerName ? t('history.week.emptyTracker', { tracker: trackerName }) : t('history.week.empty')}
        </Text>
      </Card>
    );
  } else {
    body = (
      <View>
        {items.map((item) => (
          <SessionRow key={item.id} item={item} tracker={trackers.get(item.tracker_id)} today={today} onOpen={onOpen} />
        ))}
        {more ? (
          <Button label={loadingMore ? t('history.week.loadingMore') : t('history.week.more')} variant="ghost" onPress={onMore} />
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ gap: space[16] }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[8] }}>
        <Text variant="h3" accessibilityRole="header" style={{ flex: 1 }}>
          {text.weekTitle(week, today)}
        </Text>
        {items && items.length > 0 ? (
          <Text variant="caption" tone="muted">
            {more ? t('history.week.countMore', { count: items.length }) : t('history.week.count', { count: items.length })}
          </Text>
        ) : null}
      </View>
      {body}
    </View>
  );
}

/** "Month in review" beside the calendar on tablets and desktop: sessions and active hours of the month shown. */
export function MonthReview({ month }: { month: CalendarMonth | undefined }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const text = useHistoryText();
  const stats = [
    { label: t('history.review.sessions'), value: month ? text.number(month.session_count) : '—' },
    { label: t('history.review.hours'), value: month ? text.hours(month.active_time_s) : '—' },
  ];
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      <Text variant="caption" tone="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }} accessibilityRole="header">
        {t('history.review.title')}
      </Text>
      <View style={{ flexDirection: 'row', gap: space[16] }}>
        {stats.map((stat) => (
          <View key={stat.label} style={{ flex: 1, gap: 4 }} accessible aria-label={`${stat.label}: ${stat.value}`}>
            <Text variant="caption" tone="muted">
              {stat.label}
            </Text>
            <Text variant="h1" style={{ fontVariant: ['tabular-nums'] }}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** History before the first session (design: System / History empty): a word and one action. */
export function HistoryEmpty({ onLog }: { onLog: () => void }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ padding: space[24], gap: space[16] }}>
      <Sparkles color={colors.accent.text} size={24} strokeWidth={1.75} />
      <View style={{ gap: space[8] }}>
        <Text variant="h3" accessibilityRole="header">
          {t('history.empty.title')}
        </Text>
        <Text variant="small" tone="muted">
          {t('history.empty.body')}
        </Text>
      </View>
      <Button label={t('history.empty.action')} variant="secondary" onPress={onLog} />
    </Card>
  );
}
