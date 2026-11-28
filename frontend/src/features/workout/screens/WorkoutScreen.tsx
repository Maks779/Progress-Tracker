import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { NotificationAskSheet, useAskOnRest } from '@/features/notifications/components';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import { useBreakpoint, useSideColumn } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { IconButton } from '@/shared/ui/IconButton';
import { Ellipsis, Sparkles } from '@/shared/ui/icons';
import { Notice } from '@/shared/ui/Notice';
import { Screen } from '@/shared/ui/Screen';
import { Text } from '@/shared/ui/Text';

import { ExerciseCard } from '../components/ExerciseCard';
import { NoWorkout } from '../components/NoWorkout';
import { DiscardSheet, ExerciseMenu, FinishSheet, RenameSheet, SetMenu, WorkoutMenu } from '../components/sheets';
import { GhostTip, SessionSoFar } from '../components/SideCards';
import { Elapsed, RestTimer } from '../components/Timers';
import { exerciseName } from '../exercises';
import { cardsOf, type DraftExercise, MAX_EXERCISES, setNumber, tally, type WorkoutDraft } from '../rules';
import { useActiveDraft, useActiveSummary } from '../start';
import { workout } from '../store';

type OpenSheet =
  | { kind: 'finish' | 'discard' | 'rename' | 'menu' }
  | { kind: 'exercise'; index: number }
  | { kind: 'set'; index: number; setIndex: number };

/**
 * The active workout (design: Workout / Active / Rest timer): the name and elapsed time with
 * Finish, an exercise card per exercise or superset, Add exercise, and the rest timer, which
 * floats above the tab bar on phones and sits in the side column on desktop with the session
 * so far, a note on ghost values and Discard. Every change is saved on the device at once.
 */
export function WorkoutScreen() {
  const draft = useActiveDraft();
  const summary = useActiveSummary();
  const [leaving, setLeaving] = useState<WorkoutDraft | null>(null);
  const shown = draft ?? leaving;
  if (!shown) {
    return summary ? <Redirect href="/workout/summary" /> : <NoWorkout />;
  }
  return <ActiveWorkout draft={shown} onLeave={() => setLeaving(shown)} />;
}

function ActiveWorkout({ draft, onLeave }: { draft: WorkoutDraft; onLeave: () => void }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const compact = useBreakpoint() === 'compact';
  const side = useSideColumn(false) !== null;
  const trackers = useListTrackers({ include_archived: true });
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const askNotifications = useAskOnRest(draft.rest !== null);
  const close = () => setSheet(null);
  const counts = tally(draft.exercises);
  const trackerName =
    (trackers.data?.status === 200 ? trackers.data.data.items.find((tracker) => tracker.id === draft.trackerId)?.name : undefined) ??
    draft.name;
  const nameOf = (exercise: DraftExercise) => exerciseName(exercise.info, t);
  const names = draft.exercises.map(nameOf);
  const empty = draft.exercises.length === 0;
  const addExercise = () => router.push('/workout/add-exercise');
  const discard = () => {
    onLeave();
    close();
    router.dismissTo('/');
    workout.discard();
  };

  const main = (
    <>
      {draft.prefillFailed ? <Notice tone="info" title={t('workout.prefillFailed.title')} message={t('workout.prefillFailed.body')} /> : null}
      {cardsOf(draft.exercises).map((members) => (
        <ExerciseCard
          key={draft.exercises[members[0]].id}
          members={members}
          exercises={draft.exercises}
          nameOf={nameOf}
          actions={workout}
          onMenu={(index) => setSheet({ kind: 'exercise', index })}
          onSetMenu={(index, setIndex) => setSheet({ kind: 'set', index, setIndex })}
        />
      ))}
      {empty ? (
        <Card style={{ padding: space[24], gap: space[16] }}>
          <Sparkles color={colors.accent.text} size={24} strokeWidth={1.75} />
          <View style={{ gap: space[8] }}>
            <Text variant="h3">{t('workout.empty.title')}</Text>
            <Text variant="small" tone="muted">
              {t('workout.empty.body')}
            </Text>
          </View>
          <Button label={t('workout.addExercise')} onPress={addExercise} />
        </Card>
      ) : draft.exercises.length < MAX_EXERCISES ? (
        <Button label={t('workout.addExercise')} variant="secondary" onPress={addExercise} />
      ) : null}
      {!side && draft.rest ? <View style={{ height: 72 }} /> : null}
    </>
  );
  const sideColumn = side ? (
    <>
      {draft.rest ? <RestTimer rest={draft.rest} /> : null}
      <SessionSoFar counts={counts} />
      <GhostTip />
      <Button label={t('workout.discard.confirm')} variant="secondary" onPress={() => setSheet({ kind: 'discard' })} />
    </>
  ) : undefined;

  const exercise = sheet?.kind === 'exercise' || sheet?.kind === 'set' ? draft.exercises[sheet.index] : undefined;
  const setTitle = (index: number, setIndex: number) => {
    const number = setNumber(draft.exercises[index].sets, setIndex);
    const set = number === null ? t('workout.set.warmupName') : t('workout.set.name', { number });
    return t('workout.set.menuTitle', { set, name: names[index] });
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.base }}>
      <Screen
        title={draft.name}
        caption={<Elapsed startedAt={draft.startedAt} />}
        action={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
            <Button label={t('workout.finish.action')} size="compact" onPress={() => setSheet({ kind: 'finish' })} />
            <IconButton icon={Ellipsis} label={t('workout.menu.title')} onPress={() => setSheet({ kind: 'menu' })} />
          </View>
        }
      >
        <Columns main={main} side={sideColumn} />
      </Screen>
      {!side && draft.rest ? (
        <View style={{ position: 'absolute', left: compact ? space[24] : space[40], right: compact ? space[24] : space[40], bottom: space[16] }}>
          <RestTimer rest={draft.rest} floating />
        </View>
      ) : null}
      {sheet?.kind === 'finish' ? <FinishSheet draft={draft} trackerName={trackerName} exerciseNames={names} onClose={close} /> : null}
      {sheet?.kind === 'discard' ? <DiscardSheet onDiscard={discard} onClose={close} /> : null}
      {sheet?.kind === 'rename' ? <RenameSheet name={draft.name} onClose={close} /> : null}
      {sheet?.kind === 'menu' ? (
        <WorkoutMenu onRename={() => setSheet({ kind: 'rename' })} onDiscard={() => setSheet({ kind: 'discard' })} onClose={close} />
      ) : null}
      {sheet?.kind === 'exercise' && exercise ? (
        <ExerciseMenu
          draft={draft}
          index={sheet.index}
          name={names[sheet.index]}
          nextName={names[sheet.index + 1]}
          actions={workout}
          onClose={close}
        />
      ) : null}
      {sheet?.kind === 'set' && exercise ? (
        <SetMenu
          draft={draft}
          index={sheet.index}
          setIndex={sheet.setIndex}
          title={setTitle(sheet.index, sheet.setIndex)}
          actions={workout}
          onClose={close}
        />
      ) : null}
      {askNotifications && !sheet ? <NotificationAskSheet onClose={() => undefined} /> : null}
    </View>
  );
}
