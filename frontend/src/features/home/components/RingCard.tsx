import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useGoalText } from '@/features/goals/format';
import { fromCanonical, type Metric } from '@/features/goals/rules';
import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Flame, Target } from '@/shared/ui/icons';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import { Text } from '@/shared/ui/Text';

import { useHomeText } from '../format';
import { ringMessage } from '../rules';

type RingProps = { goal: GoalOut; tracker: TrackerSummary; wide: boolean; children?: ReactNode };

/**
 * The week at a glance, as on Home in the design: the ring with this week's progress of the
 * pinned goal, a line of encouragement, the numbers in words and the streak badge. Below it
 * (`children`): Start workout and, on tablets and desktop, the week's totals.
 */
export function RingCard({ goal, tracker, wide, children }: RingProps) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const text = useGoalText();
  const { number } = useHomeText();
  const metric = goal.metric as Metric;
  const shown = (canonical: number) => number(fromCanonical(metric, canonical, text.distanceUnit), 2);
  const value = shown(goal.progress.value);
  const target = goal.progress.target;
  const caption =
    tracker.type === 'strength' && metric === 'sessions'
      ? t('home.ring.workouts', { value, count: target })
      : t('home.ring.progress', { value, target: text.amount(metric, target, tracker) });
  const streak = goal.streak_weeks ?? 0;

  return (
    <Card style={{ padding: wide ? space[24] : space[16], gap: space[24] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[24] }}>
        <ProgressRing size={wide ? 152 : 112} progress={goal.progress.value / target} accessibilityLabel={caption}>
          <Text variant={value.length > 3 ? 'h1' : 'display'} style={{ fontVariant: ['tabular-nums'] }}>
            {value}
          </Text>
          <Text variant="caption" tone="muted">
            {t('home.ring.of', { target: shown(target) })}
          </Text>
        </ProgressRing>
        <View style={{ flex: 1, alignItems: 'flex-start', gap: space[8] }}>
          <Text variant="h3">{t(`home.ring.${ringMessage(goal)}`)}</Text>
          <Text variant="caption" tone="muted">
            {caption}
          </Text>
          {streak > 0 ? <Badge icon={Flame} label={t('home.ring.streak', { count: streak })} color={colors.accent.text} /> : null}
        </View>
      </View>
      {children}
    </Card>
  );
}

type SetGoalProps = { tracker: TrackerSummary; onSetGoal: () => void; children?: ReactNode };

/**
 * In place of the ring while the tracker has no weekly goal: what one would do, and the way to
 * set it; `children` go below (Start workout).
 */
export function SetGoalCard({ tracker, onSetGoal, children }: SetGoalProps) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ padding: space[24], gap: space[16] }}>
      <Target color={colors.accent.text} size={24} strokeWidth={1.75} />
      <View style={{ gap: space[8] }}>
        <Text variant="h3">{t('home.setGoal.title')}</Text>
        <Text variant="small" tone="muted">
          {t('home.setGoal.body', { tracker: tracker.name })}
        </Text>
      </View>
      <Button label={t('home.setGoal.action')} onPress={onSetGoal} />
      {children}
    </Card>
  );
}

export type WeekStat = { label: string; value: string; unit: string };

/** The week's totals in three columns: label, figure, unit ("Active time · 96 · minutes this week"). */
export function WeekStats({ stats }: { stats: WeekStat[] }) {
  const { space } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space[16] }}>
      {stats.map((stat) => (
        <View key={stat.label} style={{ flex: 1, gap: space[4] }} accessible accessibilityLabel={`${stat.label}: ${stat.value} ${stat.unit}`}>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {stat.label}
          </Text>
          <Text variant="h1" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
            {stat.value}
          </Text>
          <Text variant="caption" tone="muted">
            {stat.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}
