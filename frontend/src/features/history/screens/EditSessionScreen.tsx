import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAccountId } from '@/features/auth/account';
import { QuickLogForm } from '@/features/quicklog/components/QuickLogForm';
import { WhenField } from '@/features/quicklog/components/WhenField';
import { useBooks } from '@/features/quicklog/data';
import { formFromSession, kindOf, startedAt } from '@/features/quicklog/rules';
import { ExerciseCard } from '@/features/workout/components/ExerciseCard';
import { ExerciseMenu, SetMenu } from '@/features/workout/components/sheets';
import { exerciseName, useExerciseCatalog } from '@/features/workout/exercises';
import { cardsOf, type DraftExercise, setNumber } from '@/features/workout/rules';
import { CACHE_GC_TIME } from '@/shared/api/cache';
import { useOffline } from '@/shared/api/connection';
import { ApiError } from '@/shared/api/fetcher';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useGetSession } from '@/shared/api/generated/endpoints/sessions/sessions';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { BookOut, SessionOut, TrackerSummary } from '@/shared/api/generated/model';
import { useNow } from '@/shared/hooks/useNow';
import { newId } from '@/shared/ids';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { Notice } from '@/shared/ui/Notice';
import { Screen } from '@/shared/ui/Screen';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';
import { showToast } from '@/shared/ui/Toast';

import { type EditFailure, saveEditedSession } from '../data';
import { sessionEdit, useSessionEdit } from '../editing';
import { useHistoryText } from '../format';
import { draftFromSession, editedStrength, MAX_NAME, strengthProblems } from '../rules';

const NOTE_MAX = 500;

type OpenSheet = { kind: 'exercise'; index: number } | { kind: 'set'; index: number; setIndex: number };

function backToSession(id: string) {
  router.dismissTo(`/history/${id}`);
}

function useEditMessage() {
  const { t } = useTranslation();
  return (failure: EditFailure, page?: number) => t(`history.edit.errors.${failure}`, { page });
}

/**
 * Edit session (design: History / Edit session, decision #18): a workout in the active-workout
 * editor (exercise blocks and set rows, with its name, duration, day and note), any other
 * session in its quick log form. Save changes replaces the session; History, Home, goals and
 * streaks follow. Editing needs a connection.
 */
export function EditSessionScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useGetSession(id ?? '', { query: { enabled: Boolean(id), gcTime: CACHE_GC_TIME } });
  const trackers = useListTrackers({ include_archived: true });
  const books = useBooks();
  const text = useHistoryText();
  const data = session.data?.status === 200 ? session.data.data : undefined;
  const tracker =
    data && trackers.data?.status === 200 ? trackers.data.data.items.find((item) => item.id === data.tracker_id) : undefined;
  const missing = session.error instanceof ApiError && session.error.status === 404;
  const waiting = session.isPending || trackers.isPending || (data?.tracker_type === 'reading' && books.items === undefined && !books.query.isError);

  let body;
  if (data && tracker && !waiting) {
    body =
      tracker.type === 'strength' ? (
        <StrengthEdit session={data} tracker={tracker} />
      ) : (
        <QuickEdit session={data} tracker={tracker} books={books.items ?? []} />
      );
  } else if (waiting) {
    body = <SkeletonCard label={t('history.detail.loading')} rows={3} />;
  } else if (missing || (data && !tracker)) {
    body = (
      <Card style={{ gap: 16 }}>
        <Text variant="small" tone="muted">
          {t('history.detail.missing')}
        </Text>
        <Button label={t('history.detail.back')} variant="secondary" onPress={() => router.dismissTo('/history')} />
      </Card>
    );
  } else {
    body = (
      <ErrorCard
        title={t('history.detail.errorTitle')}
        message={t('history.loadError')}
        retryLabel={t('history.retry')}
        onRetry={() => session.refetch()}
      />
    );
  }

  return (
    <Screen
      title={t('history.edit.title')}
      caption={data ? text.startedCaption(data.started_at) : undefined}
      back={{ label: t('nav.session'), onPress: () => backToSession(id ?? '') }}
    >
      {body}
    </Screen>
  );
}

function useSaved(id: string) {
  const { t } = useTranslation();
  return () => {
    backToSession(id);
    showToast(t('history.edit.saved'));
  };
}

function QuickEdit({ session, tracker, books }: { session: SessionOut; tracker: TrackerSummary; books: BookOut[] }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const offline = useOffline();
  const accountId = useAccountId();
  const goals = useListGoals();
  const message = useEditMessage();
  const saved = useSaved(session.id);
  const kind = kindOf(tracker);
  if (!kind) {
    return null;
  }
  const previousEnd = session.reading ? session.reading.end_page - (session.stats.pages_read ?? 0) : undefined;
  return (
    <QuickLogForm
      tracker={tracker}
      kind={kind}
      trackers={[]}
      goals={goals.data?.status === 200 ? goals.data.data.items : []}
      books={books}
      accountId={accountId}
      mode={{
        kind: 'edit',
        session,
        saveLabel: t('history.edit.save'),
        blocked: offline ? t('history.edit.offline') : undefined,
        save: async (body) => {
          const failure = await saveEditedSession(client, session.id, body);
          if (failure) {
            return message(failure, previousEnd);
          }
          saved();
          return null;
        },
      }}
    />
  );
}

function StrengthEdit({ session, tracker }: { session: SessionOut; tracker: TrackerSummary }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const client = useQueryClient();
  const wide = useBreakpoint() !== 'compact';
  const offline = useOffline();
  const accountId = useAccountId();
  const catalog = useExerciseCatalog();
  const message = useEditMessage();
  const saved = useSaved(session.id);
  const draft = useSessionEdit((state) => state.draft);
  const now = useNow(30_000);
  const ready = catalog.items !== undefined || catalog.query.isError;
  const [startDuration] = useState(() => (session.duration_s ? String(Math.max(1, Math.round(session.duration_s / 60))) : ''));
  const [duration, setDuration] = useState(startDuration);
  const [note, setNote] = useState(session.note ?? '');
  const [when, setWhen] = useState(() => {
    const form = formFromSession('duration', session, 'km');
    return { date: form.date, time: form.time };
  });
  const [whenChanged, setWhenChanged] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<OpenSheet | null>(null);

  useEffect(() => {
    if (ready && accountId && useSessionEdit.getState().draft?.id !== session.id) {
      sessionEdit.start(draftFromSession(session, accountId, catalog.byId, newId));
    }
  }, [ready, accountId, session, catalog.byId]);
  useEffect(() => () => sessionEdit.end(), []);

  if (!draft || draft.id !== session.id) {
    return <SkeletonCard label={t('history.detail.loading')} rows={3} />;
  }

  const nameOf = (exercise: DraftExercise) => exerciseName(exercise.info, t);
  const names = draft.exercises.map(nameOf);
  const problems = strengthProblems(draft, duration);
  const future = whenChanged && startedAt(when.date, when.time).getTime() > now;
  const close = () => setSheet(null);
  const setTitle = (index: number, setIndex: number) => {
    const number = setNumber(draft.exercises[index].sets, setIndex);
    const set = number === null ? t('workout.set.warmupName') : t('workout.set.name', { number });
    return t('workout.set.menuTitle', { set, name: names[index] });
  };

  const save = async () => {
    setTried(true);
    setError(null);
    if (problems.length > 0 || future) {
      return;
    }
    const at = whenChanged
      ? { startedAt: startedAt(when.date, when.time).toISOString(), localDate: when.date }
      : { startedAt: session.started_at, localDate: session.local_date };
    const body = editedStrength(draft, duration, note, at);
    const kept = duration === startDuration && session.duration_s ? { ...body, duration_s: session.duration_s } : body;
    const failure = await saveEditedSession(client, session.id, kept);
    if (failure) {
      setError(message(failure));
      return;
    }
    sessionEdit.end();
    saved();
  };

  const listProblem = tried ? problems.find((problem) => problem === 'empty' || problem === 'sets') : undefined;
  const main = (
    <>
      <Card style={{ gap: space[24], padding: wide ? space[32] : space[16] }}>
        <TextField
          label={t('history.edit.name')}
          value={draft.name}
          placeholder={tracker.name}
          onChangeText={(name) => sessionEdit.rename(name)}
          maxLength={MAX_NAME}
        />
        <TextField
          label={t('history.edit.duration')}
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
          error={tried && problems.includes('duration') ? t('history.edit.problems.duration') : undefined}
        />
        <WhenField
          date={when.date}
          time={when.time}
          error={tried && future ? t('quickLog.problems.when.inFuture') : undefined}
          onChange={(date, time) => {
            setWhen({ date, time });
            setWhenChanged(true);
          }}
        />
      </Card>
      {cardsOf(draft.exercises).map((members) => (
        <ExerciseCard
          key={draft.exercises[members[0]].id}
          members={members}
          exercises={draft.exercises}
          nameOf={nameOf}
          actions={sessionEdit}
          editing
          showProblems={tried}
          onMenu={(index) => setSheet({ kind: 'exercise', index })}
          onSetMenu={(index, setIndex) => setSheet({ kind: 'set', index, setIndex })}
        />
      ))}
      <Button label={t('workout.addExercise')} variant="secondary" onPress={() => router.push(`/history/${session.id}/add-exercise`)} />
      <Card style={{ gap: space[24], padding: wide ? space[32] : space[16] }}>
        <TextField label={t('history.edit.note')} value={note} onChangeText={setNote} maxLength={NOTE_MAX} />
        {listProblem ? <Notice tone="error" title={t(`history.edit.problems.${listProblem}`)} /> : null}
        {offline ? <Notice tone="info" title={t('history.edit.offline')} /> : null}
        {error ? <Notice tone="error" title={error} /> : null}
        <Button label={t('history.edit.save')} onPress={save} disabled={offline} />
      </Card>
    </>
  );
  const side = wide ? (
    <Card style={{ padding: space[16], gap: space[8] }}>
      <Text variant="h3" accessibilityRole="header">
        {t('history.edit.sideTitle')}
      </Text>
      <Text variant="small" tone="muted">
        {t('history.edit.sideBody')}
      </Text>
    </Card>
  ) : undefined;

  return (
    <View>
      <Columns main={main} side={side} />
      {sheet?.kind === 'exercise' && draft.exercises[sheet.index] ? (
        <ExerciseMenu
          draft={draft}
          index={sheet.index}
          name={names[sheet.index]}
          nextName={names[sheet.index + 1]}
          actions={sessionEdit}
          onClose={close}
        />
      ) : null}
      {sheet?.kind === 'set' && draft.exercises[sheet.index] ? (
        <SetMenu
          draft={draft}
          index={sheet.index}
          setIndex={sheet.setIndex}
          title={setTitle(sheet.index, sheet.setIndex)}
          actions={sessionEdit}
          onClose={close}
        />
      ) : null}
    </View>
  );
}
