import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { errorMessageKey } from '@/features/auth/errors';
import { ApiError } from '@/shared/api/fetcher';
import { GoalCard } from '@/features/goals/components';
import { getReadMeQueryKey, updateMe, useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { deleteTracker, updateTracker, useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { GoalOut, TrackerSummary } from '@/shared/api/generated/model';
import { refreshAccountData } from '@/shared/api/refresh';
import { toIsoDate } from '@/shared/format/dates';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { Star } from '@/shared/ui/icons';
import { Notice } from '@/shared/ui/Notice';
import { Screen } from '@/shared/ui/Screen';
import { Sheet } from '@/shared/ui/Sheet';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';

import type { TrackerColor, TrackerIcon } from '../catalog';
import { TrackerFields } from '../components/fields';
import { ColorPicker, IconPicker } from '../components/pickers';
import { trackerSchema, type TrackerValues, updateBody } from '../schemas';

/** A 404 means the tracker was deleted meanwhile, e.g. on another device. */
function failureKey(failure: unknown): string {
  return failure instanceof ApiError && failure.status === 404 ? 'trackers.errors.notFound' : errorMessageKey(failure);
}

function valuesOf(tracker: TrackerSummary): TrackerValues {
  return {
    type: tracker.type,
    name: tracker.name,
    description: tracker.description ?? '',
    mode: tracker.general_mode ?? 'duration',
    unit: tracker.counter_unit ?? '',
    unitNote: tracker.counter_unit_note ?? '',
    color: tracker.color as TrackerColor,
    icon: tracker.icon as TrackerIcon,
  };
}

type DeleteProps = { tracker: TrackerSummary; onArchive: () => Promise<void>; onDelete: () => Promise<void>; onClose: () => void };

/** Deleting removes the sessions too, so the sheet says how many and offers archiving instead. */
function DeleteTrackerSheet({ tracker, onArchive, onDelete, onClose }: DeleteProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = (action: () => Promise<void>) => async () => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      setError(failureKey(failure));
      setBusy(false);
    }
  };
  return (
    <Sheet visible title={t('trackers.delete.title', { name: tracker.name })} onClose={busy ? () => undefined : onClose}>
      <Text tone="muted">{t('trackers.delete.body', { sessions: t('sessions', { count: tracker.session_count }) })}</Text>
      {error ? <Notice tone="error" title={t(error)} /> : null}
      <Button label={t('trackers.delete.confirm')} variant="destructive" onPress={run(onDelete)} disabled={busy} />
      {tracker.archived ? null : (
        <Button label={t('trackers.delete.archiveInstead')} variant="secondary" onPress={run(onArchive)} disabled={busy} />
      )}
      <Button label={t('trackers.delete.cancel')} variant="ghost" onPress={onClose} disabled={busy} />
    </Sheet>
  );
}

type EditorProps = { tracker: TrackerSummary; goals: GoalOut[]; isMain: boolean };

function TrackerEditor({ tracker, goals, isMain }: EditorProps) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const leave = () => router.dismissTo('/profile/trackers');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const counter = tracker.general_mode === 'counter';
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<TrackerValues>({ resolver: zodResolver(trackerSchema), mode: 'onTouched', defaultValues: valuesOf(tracker) });
  const color = useWatch({ control, name: 'color' });
  const today = toIsoDate(new Date());

  const save = useExclusive(
    handleSubmit(async (values) => {
      setError(null);
      setSaved(false);
      try {
        await updateTracker(tracker.id, updateBody(values, counter));
        reset(values);
        setSaved(true);
        await refreshAccountData(queryClient);
      } catch (failure) {
        setError(failureKey(failure));
      }
    }),
  );

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await refreshAccountData(queryClient);
    } catch (failure) {
      setError(failureKey(failure));
    } finally {
      setBusy(false);
    }
  }

  const toggleArchive = () => run(() => updateTracker(tracker.id, { archived: !tracker.archived }));
  const makeMain = () =>
    run(async () => {
      const response = await updateMe({ main_tracker_id: tracker.id });
      queryClient.setQueryData(getReadMeQueryKey(), response);
    });

  async function archiveFromSheet() {
    await updateTracker(tracker.id, { archived: true });
    setDeleting(false);
    await refreshAccountData(queryClient);
  }

  async function remove() {
    await deleteTracker(tracker.id);
    setDeleting(false);
    leave();
    await refreshAccountData(queryClient);
  }

  const form = (
    <Card style={{ gap: space[24], padding: space[24] }}>
      <Text variant="h3" accessibilityRole="header">
        {t('trackers.detail.details')}
      </Text>
      <TrackerFields control={control} errors={errors} type={tracker.type} mode={tracker.general_mode ?? 'duration'} modeLocked />
      <Controller control={control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
      <Controller
        control={control}
        name="icon"
        render={({ field }) => <IconPicker value={field.value} color={color} onChange={field.onChange} />}
      />
      {saved && !isDirty ? <Notice tone="success" title={t('trackers.detail.saved')} /> : null}
      <Button label={t('trackers.detail.save')} onPress={save} loading={isSubmitting} disabled={!isDirty} />
    </Card>
  );

  const goalList = (
    <Card style={{ gap: space[16], padding: space[24] }}>
      <Text variant="h3" accessibilityRole="header">
        {t('trackers.detail.goals')}
      </Text>
      {goals.length === 0 ? <Text tone="muted">{t('trackers.detail.noGoals')}</Text> : null}
      {goals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          tracker={tracker}
          today={today}
          showPinned={goals.filter((other) => other.period === 'week').length > 1}
          onPress={() => router.push({ pathname: '/profile/goals/[id]', params: { id: goal.id } })}
        />
      ))}
      {tracker.archived ? null : (
        <Button
          label={t('trackers.detail.createGoal')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/profile/goals/new', params: { tracker: tracker.id } })}
        />
      )}
    </Card>
  );

  const side = (
    <>
      {tracker.type === 'strength' && !tracker.archived ? (
        <Card style={{ gap: space[16], padding: space[24] }}>
          <Star color={colors.accent.text} size={24} strokeWidth={1.75} />
          <Text variant="h3">{t(isMain ? 'trackers.detail.mainTitle' : 'trackers.detail.makeMainTitle')}</Text>
          <Text variant="small" tone="muted">
            {t('trackers.detail.mainBody')}
          </Text>
          {isMain ? null : <Button label={t('trackers.detail.makeMain')} variant="secondary" onPress={makeMain} disabled={busy} />}
        </Card>
      ) : null}
      <Card style={{ gap: space[16], padding: space[24] }}>
        <Text variant="small" tone="muted">
          {t(tracker.archived ? 'trackers.detail.restoreBody' : 'trackers.detail.archiveBody')}
        </Text>
        <Button
          label={t(tracker.archived ? 'trackers.detail.restore' : 'trackers.detail.archive')}
          variant="secondary"
          onPress={toggleArchive}
          disabled={busy}
        />
        <Button label={t('trackers.detail.delete')} variant="secondary" onPress={() => setDeleting(true)} disabled={busy} />
      </Card>
    </>
  );

  return (
    <>
      {tracker.archived ? <Notice tone="info" title={t('trackers.detail.archivedNotice')} /> : null}
      {error ? <Notice tone="error" title={t(error)} /> : null}
      <Columns
        main={
          <>
            {form}
            {goalList}
          </>
        }
        side={side}
      />
      {deleting ? (
        <DeleteTrackerSheet tracker={tracker} onArchive={archiveFromSheet} onDelete={remove} onClose={() => setDeleting(false)} />
      ) : null}
    </>
  );
}

/** One tracker: edit it, see its goals, make it the main tracker, archive or delete it. */
export function TrackerScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const back = () => router.dismissTo('/profile/trackers');
  const trackers = useListTrackers({ include_archived: true });
  const goals = useListGoals();
  const me = useReadMe();
  const items = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
  const tracker = items?.find((item) => item.id === id);
  const goalItems = goals.data?.status === 200 ? goals.data.data.items.filter((goal) => goal.tracker_id === id) : [];
  const isMain = me.data?.status === 200 && me.data.data.main_tracker_id === id;

  let body;
  if (trackers.isPending) {
    body = <SkeletonCard label={t('trackers.loading')} rows={3} />;
  } else if (!items) {
    body = <ErrorCard message={t('trackers.loadError')} retryLabel={t('trackers.retry')} onRetry={() => trackers.refetch()} />;
  } else if (!tracker) {
    body = <Notice tone="info" title={t('trackers.errors.notFound')} />;
  } else {
    body = <TrackerEditor key={tracker.id} tracker={tracker} goals={goalItems} isMain={isMain} />;
  }

  const caption = tracker
    ? [t(`trackers.types.${tracker.type}`), t('sessions', { count: tracker.session_count })].join(' · ')
    : undefined;
  return (
    <Screen title={tracker?.name ?? t('trackers.label')} caption={caption} back={{ label: t('trackers.label'), onPress: back }}>
      {body}
    </Screen>
  );
}
