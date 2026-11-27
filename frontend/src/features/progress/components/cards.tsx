import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { exerciseName } from '@/features/workout/exercises';
import type { ExerciseOut, GoalOut, ProgressStats, RecordOut } from '@/shared/api/generated/model';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Check, ChevronDown, Dumbbell, Sparkles, TrendingUp, Trophy } from '@/shared/ui/icons';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';

import { useProgressText } from '../format';
import { consistencyGrid, type Period, periodStart } from '../rules';
import { BarChart, ConsistencyGrid, LineChart } from './charts';

type LineProps = {
  exercise: ExerciseOut | undefined;
  points: { local_date: string; weight_kg: number }[] | undefined;
  change: number | null | undefined;
  period: Period;
  loading: boolean;
  onPick: () => void;
};

/**
 * The exercise line (design: "Bench press · kg ⌄", "62.5", "+7.5 kg in 4 weeks"): the heaviest
 * working set of each session in the period. The name opens the list of exercises done.
 */
export function ExerciseLineCard({ exercise, points, change, period, loading, onPick }: LineProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const text = useProgressText();
  const name = exercise ? exerciseName(exercise, t) : '';
  const unit = t(`profile.units.${text.weightUnit}`);
  const latest = points && points.length > 0 ? points[points.length - 1] : undefined;
  const changeLine = text.change(change, period);
  let body;
  if (!points) {
    body = loading ? <View style={{ height: wide ? 200 : 160 }} /> : null;
  } else if (points.length === 0) {
    body = (
      <Text variant="small" tone="muted">
        {t('progress.line.none', { name })}
      </Text>
    );
  } else {
    body = (
      <>
        <LineChart
          values={points.map((point) => point.weight_kg)}
          dates={points.map((point) => point.local_date)}
          height={wide ? 200 : 140}
          color={colors.accent.fill}
          label={t('progress.line.label', {
            name,
            first: text.weight(points[0].weight_kg),
            firstDate: text.shortDate(points[0].local_date),
            last: text.weight(points[points.length - 1].weight_kg),
            lastDate: text.shortDate(points[points.length - 1].local_date),
          })}
          formatValue={(value) => text.weightNumber(value)}
          formatDate={text.shortDate}
        />
        {points.length === 1 ? (
          <Text variant="caption" tone="muted">
            {t('progress.line.one')}
          </Text>
        ) : null}
      </>
    );
  }
  return (
    <Card style={{ padding: space[16], gap: space[8] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <Pressable
          role="button"
          aria-label={t('progress.line.pick', { name })}
          onPress={onPick}
          style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            flexShrink: 1,
            minHeight: 32,
            borderRadius: radius[8],
            opacity: hovered ? 0.8 : 1,
            cursor: 'pointer',
            outlineStyle: 'solid',
            outlineWidth: showFocusRing(focused) ? 2 : 0,
            outlineColor: colors.accent.fill,
          })}
        >
          <Text variant="smallStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {`${name} · ${unit}`}
          </Text>
          <ChevronDown color={colors.text.primary} size={16} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {latest ? (
          <Text variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>
            {text.weightNumber(latest.weight_kg)}
          </Text>
        ) : null}
      </View>
      {changeLine ? (
        <Text variant="caption" tone="muted">
          {changeLine}
        </Text>
      ) : null}
      {body}
    </Card>
  );
}

type BarsProps = { title: string; stats: ProgressStats; kind: 'volume' | 'pages'; empty: string };

/** "Volume · kg" or "Pages / week": a bar per week (per month for 1Y and All), as framed. */
export function BarsCard({ title, stats, kind, empty }: BarsProps) {
  const { colors, space } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const text = useProgressText();
  const buckets = kind === 'volume' ? stats.volume_kg : stats.pages;
  const any = buckets.some((bucket) => bucket.value > 0);
  return (
    <Card style={{ flex: 1, padding: space[16], gap: space[16] }}>
      <Text variant="smallStrong" accessibilityRole="header">
        {title}
      </Text>
      {any ? (
        <BarChart
          height={wide ? 96 : 56}
          color={kind === 'volume' ? colors.accent.fill : colors.tracker.reading}
          dates={wide}
          label={`${title}: ${buckets.map((bucket) => `${text.bucketDate(bucket.start_date, stats.bucket)} ${kind === 'volume' ? text.weight(bucket.value) : text.number(bucket.value)}`).join(', ')}`}
          bars={buckets.map((bucket) => ({
            key: bucket.start_date,
            value: bucket.value,
            valueLabel: kind === 'volume' ? text.volumeShort(bucket.value) : text.number(bucket.value),
            dateLabel: text.bucketDate(bucket.start_date, stats.bucket),
          }))}
        />
      ) : (
        <Text variant="small" tone="muted">
          {empty}
        </Text>
      )}
    </Card>
  );
}

type ConsistencyProps = { stats: ProgressStats; period: Period; today: string; goal: GoalOut | undefined };

/** "Consistency, in weeks.": the active days of the period, their count, and the streak of the pinned weekly goal. */
export function ConsistencyCard({ stats, period, today, goal }: ConsistencyProps) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const text = useProgressText();
  const start = periodStart(period, today, stats.consistency.days[0]);
  const weeks = consistencyGrid(stats.consistency.days, start, today);
  const firstShown = weeks[0]?.find((day) => day)?.date ?? start;
  const streak = goal?.streak_weeks ?? 0;
  const span = text.monthSpan(firstShown, today);
  const count = t('progress.consistency.days', { count: stats.consistency.active_days });
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      <Text variant="smallStrong" accessibilityRole="header">
        {t('progress.consistency.title')}
      </Text>
      <ConsistencyGrid weeks={weeks} label={`${span} · ${count}`} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <Text variant="caption" tone="muted" style={{ flex: 1 }}>
          {`${span} · ${count}`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} importantForAccessibility="no-hide-descendants" aria-hidden>
          <Text variant="caption" tone="muted">
            {t('progress.consistency.less')}
          </Text>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.bg.surfaceRaised }} />
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.accent.fill }} />
          <Text variant="caption" tone="muted">
            {t('progress.consistency.more')}
          </Text>
        </View>
      </View>
      <Text variant="small" tone="muted">
        {streak > 0 ? `${t('progress.consistency.streak', { count: streak })} ${t('progress.consistency.rest')}` : t('progress.consistency.rest')}
      </Text>
    </Card>
  );
}

type TotalsProps = { stats: ProgressStats; period: Period; volume: boolean; pages: boolean };

/** The period's totals beside the charts: training volume with its change, pages read. */
export function TotalsCard({ stats, period, volume, pages }: TotalsProps) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const text = useProgressText();
  const unit = t(`profile.units.${text.weightUnit}`);
  const change = stats.totals.volume_change_percent;
  const rows = [
    volume && {
      label: t('progress.totals.volume', { period: t(`progress.last.${period}`) }),
      value: text.weightValue(stats.totals.volume_kg),
      caption:
        change === null || change === undefined
          ? unit
          : `${unit} · ${t('progress.totals.change', { change: `${change > 0 ? '+' : change < 0 ? '−' : '±'}${text.number(Math.abs(change), 1)}%` })}`,
    },
    pages && {
      label: t('progress.totals.pages', { period: t(`progress.last.${period}`) }),
      value: text.number(stats.totals.pages_read),
      caption: t('progress.totals.books', { count: stats.totals.books_read }),
    },
  ].filter((row): row is { label: string; value: string; caption: string } => Boolean(row));
  if (rows.length === 0) {
    return null;
  }
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      {rows.map((row) => (
        <View key={row.label} style={{ gap: 4 }} accessible aria-label={`${row.label}: ${row.value}, ${row.caption}`}>
          <Text variant="caption" tone="muted">
            {row.label}
          </Text>
          <Text variant="h1" style={{ fontVariant: ['tabular-nums'] }}>
            {row.value}
          </Text>
          <Text variant="caption" tone="muted">
            {row.caption}
          </Text>
        </View>
      ))}
    </Card>
  );
}

type PickProps = { exercises: ExerciseOut[]; selected: string | undefined; onPick: (id: string) => void; onClose: () => void };

/** The exercises done, most recent first, for the line. */
export function ExerciseSheet({ exercises, selected, onPick, onClose }: PickProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  return (
    <Sheet visible title={t('progress.line.pickTitle')} onClose={onClose}>
      <View role="radiogroup" aria-label={t('progress.line.pickTitle')}>
        {exercises.map((exercise) => {
          const chosen = exercise.id === selected;
          const name = exerciseName(exercise, t);
          return (
            <Pressable
              key={exercise.id}
              role="radio"
              aria-checked={chosen}
              aria-label={name}
              onPress={() => onPick(exercise.id)}
              style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[16],
                minHeight: 52,
                paddingHorizontal: space[8],
                borderRadius: radius[12],
                backgroundColor: chosen ? colors.accent.subtle : hovered ? colors.bg.surfaceRaised : 'transparent',
                cursor: 'pointer',
                outlineStyle: 'solid',
                outlineWidth: showFocusRing(focused) ? 2 : 0,
                outlineColor: colors.accent.fill,
              })}
            >
              <Dumbbell color={colors.accent.text} size={20} strokeWidth={1.75} />
              <Text variant="smallMedium" style={{ flex: 1 }}>
                {name}
              </Text>
              {chosen ? <Check color={colors.accent.text} size={18} strokeWidth={2} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

/** Progress before the second session (design: System / Progress empty): a word and one action. */
export function ProgressEmpty({ action, onAction }: { action: string; onAction: () => void }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ padding: space[24], gap: space[16] }}>
      <Sparkles color={colors.accent.text} size={24} strokeWidth={1.75} />
      <View style={{ gap: space[8] }}>
        <Text variant="h3" accessibilityRole="header">
          {t('progress.empty.title')}
        </Text>
        <Text variant="small" tone="muted">
          {t('progress.empty.body')}
        </Text>
      </View>
      <Button label={action} variant="secondary" onPress={onAction} />
    </Card>
  );
}

/** A personal best (design: Record card): the trophy, "Bench press · Max weight", the value, when and how. It opens its session. */
export function RecordCard({ record, name, onOpen }: { record: RecordOut; name: string; onOpen: () => void }) {
  const { colors, radius, space } = useTheme();
  const text = useProgressText();
  const title = `${name} · ${text.recordKind(record)}`;
  const value = text.recordValue(record);
  const detail = text.recordDetail(record);
  return (
    <Pressable
      role="link"
      aria-label={`${title}, ${value}, ${detail}`}
      onPress={onOpen}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
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
      <View style={{ flex: 1, gap: space[8] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
          <Trophy color={colors.accent.text} size={20} strokeWidth={1.75} />
          <Text variant="smallStrong" numberOfLines={2} style={{ flexShrink: 1 }}>
            {title}
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      </View>
      <Text variant="h3" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </Pressable>
  );
}

/** "Earned, one set at a time.": where records come from, and how many are new this week. */
export function RecordsNote({ newThisWeek }: { newThisWeek: number }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      <Text variant="h3" accessibilityRole="header">
        {t('progress.records.noteTitle')}
      </Text>
      <Text variant="small" tone="muted">
        {t('progress.records.noteBody')}
      </Text>
      {newThisWeek > 0 ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Badge icon={TrendingUp} color={colors.accent.text} label={t('progress.records.newThisWeek', { count: newThisWeek })} />
        </View>
      ) : null}
    </Card>
  );
}
