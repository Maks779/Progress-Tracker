import type { TFunction } from 'i18next';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useGoalText } from '@/features/goals/format';
import { exerciseName } from '@/features/workout/exercises';
import type { ExerciseOut, GoalOut, SessionOut, StrengthEntryOut, StrengthSetOut, TrackerSummary } from '@/shared/api/generated/model';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { Target, Trophy } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import { useHistoryText } from '../format';
import { entryCards, sameSets, setsVolume, sortedSets, workingSetCount } from '../rules';

type Stat = { label: string; value: string };

/** The session's numbers for its type (design: Session detail): duration, volume and sets for a workout, and so on. */
function statsOf(session: SessionOut, tracker: TrackerSummary | undefined, text: ReturnType<typeof useHistoryText>, t: TFunction): Stat[] {
  const stats: Stat[] = [];
  const duration = session.duration_s ? text.clock(session.duration_s) : null;
  if (session.tracker_type === 'strength') {
    stats.push({ label: t('history.detail.duration'), value: duration ?? '—' });
    stats.push({ label: t('history.detail.volume', { unit: t(`profile.units.${text.weightUnit}`) }), value: text.weightValue(session.stats.volume_kg ?? 0) });
    stats.push({ label: t('history.detail.sets'), value: text.number(session.stats.working_sets ?? 0) });
  } else if (session.tracker_type === 'cardio') {
    stats.push({ label: t('history.detail.duration'), value: duration ?? '—' });
    if (session.cardio?.distance_m) {
      stats.push({ label: t('history.detail.distance', { unit: text.distanceLabel }), value: text.distance(session.cardio.distance_m) });
    }
    if (session.stats.pace_s_per_km) {
      stats.push({ label: t('history.detail.pace', { unit: text.distanceLabel }), value: text.pace(session.stats.pace_s_per_km) });
    }
  } else if (session.tracker_type === 'reading') {
    stats.push({ label: t('history.detail.pagesRead'), value: text.number(session.stats.pages_read ?? 0) });
    if (session.duration_s) {
      stats.push({ label: t('history.detail.minutes'), value: text.number(Math.round(session.duration_s / 60)) });
    }
    if (session.reading) {
      stats.push({ label: t('history.detail.endPage'), value: text.number(session.reading.end_page) });
    }
  } else if (session.general?.count) {
    const unit = tracker?.counter_unit ?? t('quickLog.countUnit');
    stats.push({ label: t('history.detail.count', { unit }), value: text.number(session.general.count, 2) });
  } else {
    stats.push({ label: t('history.detail.minutes'), value: text.number(Math.round((session.duration_s ?? 0) / 60)) });
  }
  return stats;
}

export function SessionStats({ session, tracker }: { session: SessionOut; tracker: TrackerSummary | undefined }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const text = useHistoryText();
  const stats = statsOf(session, tracker, text, t);
  return (
    <Card style={{ padding: wide ? space[16] : space[16], gap: space[16] }}>
      <View style={{ flexDirection: 'row', gap: space[16] }}>
        {stats.map((stat) => (
          <View key={stat.label} style={{ flex: 1, gap: 4 }} accessible aria-label={`${stat.label}: ${stat.value}`}>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {stat.label}
            </Text>
            <Text variant="h1" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>
      {session.record_count > 0 ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Badge icon={Trophy} color={colors.accent.text} label={t('history.detail.records', { count: session.record_count })} />
        </View>
      ) : null}
    </Card>
  );
}

function SetRows({ sets }: { sets: StrengthSetOut[] }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const text = useHistoryText();
  return (
    <View style={{ gap: space[8] }}>
      {sets.map((set, index) => {
        const working = set.kind === 'working';
        const number = sets.slice(0, index + 1).filter((item) => item.kind === 'working').length;
        return (
          <View key={set.position} style={{ flexDirection: 'row', gap: space[16] }}>
            <Text
              variant={working ? 'small' : 'smallStrong'}
              tone={working ? 'muted' : 'accent'}
              style={{ width: 20, fontVariant: ['tabular-nums'] }}
              aria-label={working ? t('workout.set.name', { number }) : t('workout.set.warmupName')}
            >
              {working ? number : t('workout.set.warmupShort')}
            </Text>
            <Text variant="small" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
              {text.setLine(set)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** An exercise's sets: one line when they are all alike ("3 × 10 at 50 kg · 1,500 kg volume"), else a row each. */
function EntrySets({ entry }: { entry: StrengthEntryOut }) {
  const { t } = useTranslation();
  const text = useHistoryText();
  const sets = sortedSets(entry.sets);
  const same = sameSets(sets);
  if (!same) {
    return <SetRows sets={sets} />;
  }
  const volume = setsVolume(sets);
  return (
    <Text variant="small" tone="muted">
      {volume > 0 ? `${text.sameLine(same)} · ${t('history.detail.volumeLine', { weight: text.weight(volume) })}` : text.sameLine(same)}
    </Text>
  );
}

/**
 * The exercises of a workout (design: Session detail), in order: each with its sets; a
 * superset as one block ("Lateral raise + Cable curl", its sets and volume), then each of its
 * exercises.
 */
export function ExerciseList({ session, catalog }: { session: SessionOut; catalog: Map<string, ExerciseOut> }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const text = useHistoryText();
  const nameOf = (entry: StrengthEntryOut) => exerciseName(catalog.get(entry.exercise_id), t);
  const cards = entryCards(session.strength?.exercises ?? []);
  return (
    <Card style={{ padding: wide ? space[16] : space[16], gap: space[16] }}>
      {cards.map((members, index) => {
        if (members.length === 1) {
          return (
            <View key={members[0].id} style={{ gap: space[8] }}>
              <Text variant="h3" accessibilityRole="header">
                {nameOf(members[0])}
              </Text>
              <EntrySets entry={members[0]} />
            </View>
          );
        }
        const sets = members.flatMap((entry) => entry.sets);
        const volume = setsVolume(sets);
        const summary = t('history.detail.setsCount', { count: workingSetCount(sets) });
        return (
          <View key={members[0].id ?? index} style={{ gap: space[8], paddingLeft: space[16], borderLeftWidth: 3, borderLeftColor: colors.accent.fill }}>
            <Text variant="h3" accessibilityRole="header">
              {members.map(nameOf).join(' + ')}
            </Text>
            <Text variant="small" tone="muted">
              {volume > 0 ? `${summary} · ${t('history.detail.volumeLine', { weight: text.weight(volume) })}` : summary}
            </Text>
            {members.map((entry) => (
              <Fragment key={entry.id}>
                <Text variant="smallMedium">{nameOf(entry)}</Text>
                <EntrySets entry={entry} />
              </Fragment>
            ))}
          </View>
        );
      })}
    </Card>
  );
}

export function NoteCard({ note }: { note: string }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      <Text variant="smallStrong" accessibilityRole="header">
        {t('history.detail.note')}
      </Text>
      <Text variant="small" tone="muted">
        {note}
      </Text>
    </Card>
  );
}

/** "A week of showing up." beside a session of this week whose tracker has a weekly goal. */
export function WeekGoalCard({ goal, tracker }: { goal: GoalOut; tracker: TrackerSummary }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const goalText = useGoalText();
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      <Text variant="h3" accessibilityRole="header">
        {t('history.detail.weekTitle')}
      </Text>
      <Text variant="small" tone="muted">
        {t('history.detail.weekBody')}
      </Text>
      <View style={{ alignSelf: 'flex-start' }}>
        <Badge icon={Target} color={colors.accent.text} label={goalText.progress(goal, tracker)} />
      </View>
    </Card>
  );
}
