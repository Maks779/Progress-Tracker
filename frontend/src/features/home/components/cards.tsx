import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useGoalText } from '@/features/goals/format';
import type { Metric } from '@/features/goals/rules';
import { colorFor, TRACKER_ICONS, TYPE_DEFAULTS, type TrackerIcon } from '@/features/trackers/catalog';
import type { SessionListItem, TrackerSummary } from '@/shared/api/generated/model';
import { parseIsoDate } from '@/shared/format/dates';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Check, Sparkles, Target } from '@/shared/ui/icons';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Text } from '@/shared/ui/Text';

import { useHomeText } from '../format';
import type { NextGoal } from '../rules';

type RecentProps = { items: SessionListItem[]; trackers: Map<string, TrackerSummary>; today: string };

/** The latest sessions: tracker icon, name, day and duration, and the session's main figure. */
export function RecentSessions({ items, trackers, today }: RecentProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const text = useHomeText();
  return (
    <View style={{ gap: space[16] }}>
      <Text variant="h3" accessibilityRole="header">
        {t('home.recent.title')}
      </Text>
      {items.length === 0 ? (
        <Card style={{ padding: space[24] }}>
          <Text variant="small" tone="muted">
            {t('home.recent.empty')}
          </Text>
        </Card>
      ) : (
        items.map((item) => {
          const tracker = trackers.get(item.tracker_id);
          const look = tracker ?? TYPE_DEFAULTS[item.tracker_type];
          const Icon = TRACKER_ICONS[look.icon as TrackerIcon] ?? TRACKER_ICONS.sparkles;
          const line = text.sessionLine(item, today);
          const figure = text.headline(item);
          return (
            <View
              key={item.id}
              accessible
              accessibilityLabel={`${item.name}, ${line}, ${figure}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[16], paddingVertical: space[8] }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius[12],
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.bg.surfaceRaised,
                }}
              >
                <Icon color={colorFor(colors, look.color)} size={20} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="smallStrong" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {line}
                </Text>
              </View>
              <Text variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>
                {figure}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

/** "12 pages to your next goal": the unmet daily or weekly goal closest to done, with its bar. */
export function NextGoalCard({ next }: { next: NextGoal }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const goalText = useGoalText();
  const { goal, tracker, remaining } = next;
  const color = colorFor(colors, tracker.color);
  const title = t('home.next.title', { amount: goalText.amount(goal.metric as Metric, remaining, tracker) });
  const detail = t(`home.next.${goal.period === 'day' ? 'day' : 'week'}`, {
    tracker: tracker.name,
    progress: goalText.progress(goal, tracker),
  });
  return (
    <Card style={{ gap: space[16] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <Target color={color} size={20} strokeWidth={1.75} />
        <Text variant="smallStrong" style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      <ProgressBar value={goal.progress.value / goal.progress.target} color={color} label={title} />
      <Text variant="caption" tone="muted">
        {detail}
      </Text>
    </Card>
  );
}

type RhythmProps = { dates: string[]; active: Set<string> };

/** The week's days, Monday first, with a check on every day with a session. */
export function WeeklyRhythm({ dates, active }: RhythmProps) {
  const { t, i18n } = useTranslation();
  const { colors, radius, space } = useTheme();
  const weekday = (iso: string, style: 'narrow' | 'long') =>
    new Intl.DateTimeFormat(i18n.language, { weekday: style }).format(parseIsoDate(iso));
  const done = dates.filter((date) => active.has(date));
  const label = done.length
    ? t('home.rhythm.days', { days: done.map((date) => weekday(date, 'long')).join(', ') })
    : t('home.rhythm.none');
  return (
    <Card style={{ gap: space[16] }}>
      <Text variant="h3" accessibilityRole="header">
        {t('home.rhythm.title')}
      </Text>
      <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {dates.map((date) => {
          const on = active.has(date);
          return (
            <View key={date} style={{ alignItems: 'center', gap: space[8] }}>
              <Text variant="caption" tone="muted">
                {weekday(date, 'narrow').toLocaleUpperCase(i18n.language)}
              </Text>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radius.full,
                  borderWidth: 1.5,
                  borderColor: on ? colors.accent.fill : colors.border.default,
                  backgroundColor: on ? colors.accent.subtle : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on ? <Check color={colors.accent.text} size={14} strokeWidth={2.25} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      <Text variant="small" tone="muted">
        {t('home.rhythm.body')}
      </Text>
    </Card>
  );
}

/** Home without an active tracker (all archived): the design's empty state and its one action. */
export function HomeEmpty({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ padding: space[24], gap: space[16] }}>
      <Sparkles color={colors.accent.text} size={24} strokeWidth={1.75} />
      <View style={{ gap: space[8] }}>
        <Text variant="h3">{t('home.empty.title')}</Text>
        <Text variant="small" tone="muted">
          {t('home.empty.body')}
        </Text>
      </View>
      <Button label={t('home.empty.action')} variant="secondary" onPress={onCreate} />
    </Card>
  );
}
