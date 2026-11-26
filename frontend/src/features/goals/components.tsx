import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { colorFor } from '@/features/trackers/catalog';
import { TrackerGlyph } from '@/features/trackers/components/display';
import type { GoalOut, GoalProgressOutStatus, TrackerSummary } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Check, Clock, Flame, type LucideIcon, TrendingUp, TriangleAlert, X } from '@/shared/ui/icons';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Text } from '@/shared/ui/Text';

import { useGoalText } from './format';
import { share } from './rules';

export function StatusBadge({ status }: { status: GoalProgressOutStatus }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const look: Record<GoalProgressOutStatus, [LucideIcon, string]> = {
    on_track: [TrendingUp, colors.accent.text],
    at_risk: [TriangleAlert, colors.state.warning],
    done: [Check, colors.state.success],
    in_progress: [Clock, colors.text.muted],
    missed: [X, colors.state.error],
  };
  const [icon, color] = look[status];
  return <Badge icon={icon} color={color} label={t(`goals.status.${status}`)} />;
}

type CardProps = {
  goal: GoalOut;
  tracker: TrackerSummary;
  today: string;
  showPinned: boolean;
  onPress: () => void;
};

/**
 * A goal as in the design: tracker icon and title with the status badge, progress in words,
 * a bar in the tracker's color and when the period ends. Tapping it opens the goal.
 */
export function GoalCard({ goal, tracker, today, showPinned, onPress }: CardProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const text = useGoalText();
  const title = text.title(goal, tracker);
  const progress = text.progress(goal, tracker);
  const footer = showPinned && goal.is_pinned ? `${text.footer(goal, today)} · ${t('goals.footer.pinned')}` : text.footer(goal, today);
  return (
    <Pressable
      role="link"
      aria-label={`${title}, ${t(`goals.status.${goal.progress.status}`)}, ${progress}`}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        gap: space[16],
        padding: space[16],
        borderRadius: radius[16],
        borderWidth: 1,
        borderColor: hovered ? colors.accent.fill : colors.border.default,
        backgroundColor: colors.bg.surface,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <TrackerGlyph icon={tracker.icon} color={tracker.color} size={22} />
        <Text variant="h3" style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </Text>
        <StatusBadge status={goal.progress.status} />
      </View>
      <Text variant="small" tone="muted">
        {progress}
      </Text>
      <ProgressBar value={share(goal)} color={colorFor(colors, tracker.color)} label={progress} />
      <Text variant="caption" tone="muted">
        {footer}
      </Text>
    </Pressable>
  );
}

type StreakProps = { goal?: GoalOut; trackerName?: string };

/**
 * The streak of the main tracker's pinned weekly goal, as on the Goals screen in the design.
 * Without such a goal it explains what a weekly streak is instead.
 */
export function StreakCard({ goal, trackerName }: StreakProps) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  let title = t('goals.streak.fallbackTitle');
  let body = t('goals.streak.fallbackBody');
  if (goal && trackerName) {
    const count = goal.streak_weeks ?? 0;
    title = t('goals.streak.title', { count });
    if (goal.progress.status === 'done') {
      body = t('goals.streak.bodyMet', { count, tracker: trackerName });
    } else if (count === 0) {
      body = t('goals.streak.bodyStart', { tracker: trackerName });
    } else {
      body = t('goals.streak.body', { count, tracker: trackerName, next: count + 1 });
    }
  }
  return (
    <Card style={{ gap: space[16], padding: space[24] }}>
      <Flame color={colors.accent.text} size={24} strokeWidth={1.75} />
      <Text variant="h3">{title}</Text>
      <Text variant="small" tone="muted">
        {body}
      </Text>
      <Text variant="caption" tone="muted">
        {t('goals.streak.note')}
      </Text>
    </Card>
  );
}
