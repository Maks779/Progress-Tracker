import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useGoalText } from '@/features/goals/format';
import { colorFor } from '@/features/trackers/catalog';
import type { BookOut, GoalOut, TrackerSummary } from '@/shared/api/generated/model';
import { formatDate } from '@/shared/format/dates';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { LockKeyhole } from '@/shared/ui/icons';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Text } from '@/shared/ui/Text';

import type { QuickKind } from '../rules';

/**
 * The book beside the reading form (design: Quick log / Reading): a jacket tile with the title
 * (wrapped by words, §7.2), "168 / 320 pages · 53%", the bar and when it will be finished at
 * the recent pace (spec §3.6).
 */
export function BookCard({ book }: { book: BookOut }) {
  const { t, i18n } = useTranslation();
  const { colors, radius, space } = useTheme();
  let estimate = t('quickLog.side.noEstimate');
  if (book.finished_date) {
    estimate = t('quickLog.side.finished', { date: formatDate(book.finished_date, i18n.language) });
  } else if (book.estimated_finish_date) {
    estimate = t('quickLog.side.estimate', { date: formatDate(book.estimated_finish_date, i18n.language) });
  }
  const progress = t('quickLog.side.bookProgress', { current: book.current_page, total: book.total_pages, percent: book.progress_percent });
  return (
    <Card style={{ gap: space[16], padding: space[16] }}>
      <View style={{ flexDirection: 'row', gap: space[16], alignItems: 'center' }}>
        <View
          aria-hidden
          style={{
            width: 56,
            height: 72,
            padding: 6,
            borderRadius: radius[8],
            backgroundColor: colors.tracker.reading,
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Text variant="captionStrong" numberOfLines={4} style={{ color: colors.accent.onFill, fontSize: 10, lineHeight: 12 }}>
            {book.title.toLocaleUpperCase(i18n.language)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: space[4] }}>
          <Text variant="h3">{t('quickLog.side.readingTitle')}</Text>
          <Text variant="caption" tone="muted">
            {progress}
          </Text>
        </View>
      </View>
      <ProgressBar value={book.progress_percent / 100} color={colors.tracker.reading} label={progress} />
      <Text variant="small" tone="muted">
        {estimate}
      </Text>
    </Card>
  );
}

/** The tracker's goal beside the form: "8.4 / 12 km this week", with its bar. */
export function GoalSideCard({ goal, tracker, kind }: { goal: GoalOut; tracker: TrackerSummary; kind: QuickKind }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const goalText = useGoalText();
  const progress = t(`quickLog.side.${goal.period === 'day' ? 'day' : 'week'}`, { progress: goalText.progress(goal, tracker) });
  return (
    <Card style={{ gap: space[16], padding: space[16] }}>
      <Text variant="h3">{t(`quickLog.side.${kind}Title`)}</Text>
      <Text variant="small" tone="muted">
        {progress}
      </Text>
      <ProgressBar value={goal.progress.value / goal.progress.target} color={colorFor(colors, tracker.color)} label={progress} />
    </Card>
  );
}

/** Desktop's side note (design: "Built for quick wins."): values come prefilled, and stay private. */
export function QuickWinsCard() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ gap: space[16], padding: space[16] }}>
      <Text variant="h3">{t('quickLog.side.quickTitle')}</Text>
      <Text variant="small" tone="muted">
        {t('quickLog.side.quickBody')}
      </Text>
      <View style={{ alignItems: 'flex-start' }}>
        <Badge icon={LockKeyhole} color={colors.accent.text} label={t('quickLog.side.private')} />
      </View>
    </Card>
  );
}
