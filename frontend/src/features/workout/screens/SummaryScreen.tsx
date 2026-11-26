import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ApiError } from '@/shared/api/fetcher';
import { putSession, useListSessions } from '@/shared/api/generated/endpoints/sessions/sessions';
import type { GoalOut, RecordOut, SessionOut } from '@/shared/api/generated/model';
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
import { withNote } from '../rules';
import { useActiveSummary } from '../start';
import { workout, type WorkoutSummary } from '../store';

const NOTE_MAX = 500;

/** The volume of the tracker's workout before this one, once the list has loaded; null for a first workout. */
function usePreviousVolume(session: SessionOut): number | null | undefined {
  const list = useListSessions({ tracker_id: session.tracker_id, to_date: session.local_date, limit: 5 });
  if (list.data?.status !== 200) {
    return undefined;
  }
  const before = list.data.data.items.find((item) => item.id !== session.id && item.started_at < session.started_at);
  if (!before) {
    return null;
  }
  return before.headline.metric === 'volume_kg' ? before.headline.value : 0;
}

function SummaryStats({ session }: { session: SessionOut }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const text = useWorkoutText();
  const wide = useBreakpoint() !== 'compact';
  const previous = usePreviousVolume(session);
  const volume = session.stats.volume_kg ?? 0;
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
    { label: t('workout.stats.duration'), value: text.clock(session.duration_s ?? 0) },
    { label: t('workout.stats.volume', { unit: text.unitLabel }), value: text.weightValue(volume) },
    { label: t('workout.stats.setsLabel'), value: text.number(session.stats.working_sets ?? 0) },
  ];
  return (
    <Card style={{ padding: wide ? space[32] : space[16], gap: space[16] }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <Badge icon={Dumbbell} color={colors.tracker.strength} label={session.name ?? ''} />
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

/** The records this workout set, grouped by exercise, each badge appearing in turn. */
function RecordsCard({ records }: { records: RecordOut[] }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const text = useWorkoutText();
  const catalog = useExerciseCatalog();
  const exercises = [...new Set(records.map((record) => record.exercise_id))];
  const label = (record: RecordOut) => {
    if (record.record_type === 'max_weight') {
      return t('workout.summary.maxWeight', { weight: text.weight(record.value) });
    }
    if (record.record_type === 'max_reps') {
      return record.weight_kg === null
        ? t('workout.summary.maxRepsBodyweight', { count: record.reps })
        : t('workout.summary.maxReps', { count: record.reps, weight: text.weight(record.weight_kg) });
    }
    return t('workout.summary.estimated', { weight: text.weight(record.value) });
  };
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
                <Badge icon={Trophy} color={colors.accent.text} label={label(record)} />
              </Animated.View>
            ))}
          <Text variant="caption" tone="muted">
            {t('workout.summary.compared', { name: exerciseName(catalog.byId.get(id), t) })}
          </Text>
        </View>
      ))}
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
 * added now. Done returns to Home.
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
  const queryClient = useQueryClient();
  const side = useSideColumn(false) !== null;
  const { session, new_records: records, goals = [] } = summary.saved;
  const [note, setNote] = useState(session.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const changed = note.trim() !== (session.note ?? '');
  const goal = goals.find((item) => item.is_pinned && item.period === 'week' && item.tracker_id === session.tracker_id);

  const saveNote = async (): Promise<boolean> => {
    setError(null);
    try {
      const response = await putSession(session.id, withNote(session, note));
      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Unexpected response ${response.status}`);
      }
      workout.updateSummary(response.data);
      void queryClient.invalidateQueries();
      return true;
    } catch (cause) {
      setError(t(cause instanceof ApiError && cause.status === 0 ? 'workout.summary.noteOffline' : 'workout.summary.noteFailed'));
      return false;
    }
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
        hint={changed ? undefined : session.note ? t('workout.summary.noteSaved') : undefined}
        hintMet={Boolean(session.note) && !changed}
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
      <SummaryStats session={session} />
      {records.length > 0 ? <RecordsCard records={records} /> : null}
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
