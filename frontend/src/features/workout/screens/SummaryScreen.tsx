import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { deliverSession, removeItem, sessionKey, useOutbox } from '@/features/outbox/outbox';
import { deviceRecords } from '@/features/progress/data';
import { useListSessions } from '@/shared/api/generated/endpoints/sessions/sessions';
import type { GoalOut, RecordOut } from '@/shared/api/generated/model';
import { useBreakpoint, useSideColumn } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { Check, Dumbbell, Trophy } from '@/shared/ui/icons';
import { recordReveal } from '@/shared/ui/motion';
import { Notice } from '@/shared/ui/Notice';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Screen } from '@/shared/ui/Screen';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';

import { NoWorkout } from '../components/NoWorkout';
import { exerciseName, useExerciseCatalog } from '../exercises';
import { useWorkoutText } from '../format';
import { summaryFigures, type SummaryFigures, withNote } from '../rules';
import { useActiveSummary } from '../start';
import { workout, type WorkoutSummary } from '../store';

const NOTE_MAX = 500;

/** The volume of the tracker's workout before this one, once the list has loaded; null for a first workout. */
function usePreviousVolume(figures: SummaryFigures): number | null | undefined {
  const list = useListSessions({ tracker_id: figures.trackerId, to_date: figures.localDate, limit: 5 });
  if (list.data?.status !== 200) {
    return undefined;
  }
  const before = list.data.data.items.find((item) => item.id !== figures.sessionId && item.started_at < figures.startedAt);
  if (!before) {
    return null;
  }
  return before.headline.metric === 'volume_kg' ? before.headline.value : 0;
}

function SummaryStats({ figures, trackerName }: { figures: SummaryFigures; trackerName: string }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const text = useWorkoutText();
  const wide = useBreakpoint() !== 'compact';
  const previous = usePreviousVolume(figures);
  const volume = figures.volumeKg;
  let line: string | undefined;
  if (previous === null) {
    line = t('workout.summary.first');
  } else if (previous !== undefined && volume > 0) {
    line =
      volume > previous
        ? t('workout.summary.more', { weight: text.weight(volume - previous) })
        : t('workout.summary.steady');
  }
  const stats = [
    { label: t('workout.stats.duration'), value: text.clock(figures.durationS) },
    { label: t('workout.stats.volume', { unit: text.unitLabel }), value: text.weightValue(volume) },
    { label: t('workout.stats.setsLabel'), value: text.number(figures.workingSets) },
  ];
  return (
    <Card style={{ padding: wide ? space[32] : space[16], gap: space[16] }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <Badge icon={Dumbbell} color={colors.tracker.strength} label={figures.name ?? trackerName} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[16] }}>
        {stats.map((stat) => (
          <View key={stat.label} style={{ flex: 1, gap: 4 }} accessible accessibilityLabel={`${stat.label}: ${stat.value}`}>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {stat.label}
            </Text>
            <Text variant="h1" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>
      {line ? (
        <Text variant="small" tone="muted">
          {line}
        </Text>
      ) : null}
    </Card>
  );
}

type ShownRecord = Pick<RecordOut, 'exercise_id' | 'record_type' | 'value' | 'weight_kg' | 'reps'>;

/**
 * The records this workout set, grouped by exercise, each badge appearing in turn. While the
 * workout waits to be sent they are counted on the device against the bests saved there
 * (spec §3.4), and say so; the server's answer replaces them.
 */
function RecordsCard({ records, onDevice }: { records: ShownRecord[]; onDevice: boolean }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const text = useWorkoutText();
  const catalog = useExerciseCatalog();
  const exercises = [...new Set(records.map((record) => record.exercise_id))];
  let step = 0;
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      <Text variant="h3" accessibilityRole="header">
        {t('workout.summary.records', { count: records.length })}
      </Text>
      {exercises.map((id) => (
        <View key={id} style={{ gap: space[8], alignItems: 'flex-start' }}>
          {records
            .filter((record) => record.exercise_id === id)
            .map((record) => (
              <Animated.View key={record.record_type} entering={recordReveal(step++)}>
                <Badge icon={Trophy} color={colors.accent.text} label={text.recordBadge(record)} />
              </Animated.View>
            ))}
          <Text variant="caption" tone="muted">
            {t('workout.summary.compared', { name: exerciseName(catalog.byId.get(id), t) })}
          </Text>
        </View>
      ))}
      {onDevice ? (
        <Text variant="caption" tone="muted">
          {t('workout.summary.recordsOnDevice')}
        </Text>
      ) : null}
    </Card>
  );
}

/** The tracker's pinned weekly goal after this workout: done, or how far along. */
function GoalCard({ goal }: { goal: GoalOut }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const text = useWorkoutText();
  const { value, target } = goal.progress;
  const met = value >= target;
  const streak = goal.streak_weeks ?? 0;
  const progress = t('home.ring.workouts', { value: text.number(value), count: target });
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      <Text variant="h3">{met ? t('workout.summary.goalMet') : t('workout.summary.goalLeft', { count: target - value })}</Text>
      <ProgressBar value={value / target} color={colors.accent.fill} label={progress} />
      <Text variant="small" tone="muted">
        {streak > 0 ? `${progress} · ${t('home.ring.streak', { count: streak })}` : progress}
      </Text>
    </Card>
  );
}

/**
 * Summary after Finish (design: Workout / Summary): the session's duration, volume and sets,
 * how it compares with last time, the records it set, the weekly goal, and a note that can be
 * added now. Done returns to Home. While the session waits on the device for a connection,
 * the numbers are the device's own; the records and the goal appear once it is sent.
 */
export function SummaryScreen() {
  const summary = useActiveSummary();
  const [leaving, setLeaving] = useState<WorkoutSummary | null>(null);
  const shown = summary ?? leaving;
  if (!shown) {
    return <NoWorkout />;
  }
  return <Summary summary={shown} onLeave={() => setLeaving(shown)} />;
}

function Summary({ summary, onLeave }: { summary: WorkoutSummary; onLeave: () => void }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const side = useSideColumn(false) !== null;
  const figures = summaryFigures(summary.sessionId, summary.body, summary.saved?.session ?? null);
  const client = useQueryClient();
  const counted = useMemo(() => (summary.saved ? [] : deviceRecords(client, summary.body)), [client, summary.saved, summary.body]);
  const records: ShownRecord[] = summary.saved ? summary.saved.new_records : counted;
  const goals = summary.saved?.goals ?? [];
  const waiting = useOutbox((state) => state.items.some((item) => item.kind === 'session' && item.id === summary.sessionId));
  const [note, setNote] = useState(figures.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const changed = note.trim() !== (figures.note ?? '');
  const goal = goals.find((item) => item.is_pinned && item.period === 'week' && item.tracker_id === figures.trackerId);

  const saveNote = async (): Promise<boolean> => {
    setError(null);
    const body = withNote(summary.body, note);
    const result = await deliverSession(summary.sessionId, summary.userId, body);
    if (result.status === 'refused') {
      await removeItem(sessionKey(summary.sessionId));
      setError(t('workout.summary.noteFailed'));
      return false;
    }
    workout.summaryBody(body);
    return true;
  };
  const done = async () => {
    if (changed && !(await saveNote())) {
      return;
    }
    onLeave();
    router.dismissTo('/');
    workout.closeSummary();
  };

  const noteBlock = (
    <>
      <TextField
        label={t('workout.summary.note')}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={NOTE_MAX}
        placeholder={t('workout.summary.notePlaceholder')}
        hint={changed || !figures.note ? undefined : t(waiting ? 'workout.summary.noteWaiting' : 'workout.summary.noteSaved')}
        hintMet={Boolean(figures.note) && !changed && !waiting}
      />
      {error ? <Notice tone="error" title={error} /> : null}
      <View style={{ flexDirection: side ? 'row' : 'column', gap: space[8] }}>
        <View style={side ? { flex: 1 } : undefined}>
          <Button label={t('workout.summary.saveNote')} variant="secondary" disabled={!changed} onPress={saveNote} />
        </View>
        <View style={side ? { flex: 1 } : undefined}>
          <Button label={t('workout.summary.done')} onPress={done} />
        </View>
      </View>
    </>
  );
  const main = (
    <>
      <SummaryStats figures={figures} trackerName={summary.trackerName} />
      {summary.saved ? null : (
        <Notice tone="info" title={t('workout.summary.waitingTitle')} message={t('workout.summary.waitingBody')} />
      )}
      {records.length > 0 ? <RecordsCard records={records} onDevice={!summary.saved} /> : null}
      {side ? null : (
        <>
          {goal ? <GoalCard goal={goal} /> : null}
          {noteBlock}
        </>
      )}
    </>
  );
  const sideColumn = side ? (
    <>
      {goal ? <GoalCard goal={goal} /> : null}
      <View style={{ gap: space[16] }}>{noteBlock}</View>
    </>
  ) : undefined;

  return (
    <Screen
      title={t(records.length > 0 ? 'workout.summary.stronger' : 'workout.summary.doneTitle')}
      caption={t('workout.summary.caption')}
      action={
        <View aria-hidden style={{ paddingTop: space[8] }}>
          <Check color={colors.accent.text} size={24} strokeWidth={2} />
        </View>
      }
    >
      <Columns main={main} side={sideColumn} />
    </Screen>
  );
}
