import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { errorMessageKey } from '@/features/auth/errors';
import { createGoal, deleteGoal, updateGoal, useGetGoal, useListGoals } from '@/shared/api/generated/endpoints/goals/goals';
import { useReadMe } from '@/shared/api/generated/endpoints/me/me';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { GoalCreate, GoalOut, GoalUpdate, TrackerSummary } from '@/shared/api/generated/model';
import { ApiError } from '@/shared/api/fetcher';
import { refreshAccountData } from '@/shared/api/refresh';
import { endOfYear, toIsoDate } from '@/shared/format/dates';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useGoBack } from '@/shared/hooks/useGoBack';
import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { DateField } from '@/shared/ui/DateField';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Square, SquareCheck } from '@/shared/ui/icons';
import { Notice } from '@/shared/ui/Notice';
import { Screen } from '@/shared/ui/Screen';
import { Segmented } from '@/shared/ui/Segmented';
import { SelectField } from '@/shared/ui/SelectField';
import { Sheet } from '@/shared/ui/Sheet';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Stepper } from '@/shared/ui/Stepper';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';
import { TextLink } from '@/shared/ui/TextLink';

import { StreakCard } from '../components';
import { useGoalText } from '../format';
import {
  freeGoal,
  FREQUENCY,
  fromCanonical,
  type GoalKind,
  type GoalPeriod,
  initialTarget,
  kindsFor,
  MAX_TARGET,
  type Metric,
  metricsFor,
  parseTarget,
  toCanonical,
} from '../rules';

type Draft = {
  kind: GoalKind;
  period: GoalPeriod;
  metric: Metric;
  steps: number;
  amount: string;
  name: string;
  endDate: string;
  pin: boolean;
};

const ERRORS: Record<string, string> = {
  goal_exists: 'goals.form.errors.exists',
  not_found: 'goals.form.errors.notFound',
};

function failureKey(failure: unknown): string {
  if (failure instanceof ApiError) {
    if (failure.fieldErrors.some((field) => field.field === 'end_date')) {
      return 'goals.form.errors.endDate';
    }
    if (ERRORS[failure.code] || failure.status === 404) {
      return ERRORS[failure.code] ?? ERRORS.not_found;
    }
  }
  return errorMessageKey(failure);
}

function CheckRow({ label, hint, checked, onToggle }: { label: string; hint: string; checked: boolean; onToggle: () => void }) {
  const { colors, radius, space } = useTheme();
  const Box = checked ? SquareCheck : Square;
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={`${label}, ${hint}`}
      onPress={onToggle}
      style={({ focused }: { pressed: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[16],
        minHeight: 48,
        borderRadius: radius[8],
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Box color={checked ? colors.accent.text : colors.text.muted} size={24} strokeWidth={1.75} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space[4] }}>
      <Text variant="smallStrong">{label}</Text>
      <Text tone="muted">{value}</Text>
    </View>
  );
}

/**
 * Where the goal form goes when it is done or left: back to Home when Home's "Set a weekly
 * goal" opened it (`?from=home`), closing the form in the Profile tab; otherwise one page back.
 */
function useLeaveForm() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const back = useGoBack('/profile/goals');
  if (from !== 'home') {
    return back;
  }
  return () => {
    router.dismissTo('/profile');
    router.navigate('/');
  };
}

type FormProps = {
  trackers: TrackerSummary[];
  goals: GoalOut[];
  initialTrackerId: string;
  goal?: GoalOut;
};

/**
 * The goal form. A new goal picks a tracker, a kind (frequency, amount or cumulative) and what
 * it counts; only the combinations the API accepts are offered. Frequency targets use the
 * stepper, amounts a number field in km or mi and minutes. An existing goal keeps its tracker
 * and kind (the API cannot change them) and edits its target, name, end date and pin.
 */
function GoalForm({ trackers, goals, initialTrackerId, goal }: FormProps) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const compact = useBreakpoint() === 'compact';
  const router = useRouter();
  const queryClient = useQueryClient();
  const leave = useLeaveForm();
  const text = useGoalText();
  const today = toIsoDate(new Date());
  const [trackerId, setTrackerId] = useState(initialTrackerId);
  const tracker = trackers.find((item) => item.id === trackerId)!;
  const [draft, setDraft] = useState<Draft>(() => {
    if (goal) {
      const metric = goal.metric as Metric;
      const shown = fromCanonical(metric, goal.target, text.distanceUnit);
      return {
        kind: goal.kind,
        period: goal.period ?? 'week',
        metric,
        steps: Math.min(FREQUENCY.max, Math.max(FREQUENCY.min, shown)),
        amount: String(shown),
        name: goal.name ?? '',
        endDate: goal.end_date ?? endOfYear(new Date()),
        pin: false,
      };
    }
    const { kind, period, metric } = freeGoal(tracker, tracker.id, goals);
    return { kind, period, metric, steps: FREQUENCY.initial, amount: String(initialTarget(kind, period, metric)), name: '', endDate: endOfYear(new Date()), pin: false };
  });
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const editing = goal !== undefined;
  const period: GoalPeriod | null = draft.kind === 'cumulative' ? null : draft.kind === 'frequency' ? 'week' : draft.period;
  const weekly = period === 'week';

  function retarget(next: Pick<Draft, 'kind' | 'period' | 'metric'>): Draft {
    return { ...draft, ...next, amount: String(initialTarget(next.kind, next.period, next.metric)) };
  }

  function chooseTracker(id: string) {
    const next = trackers.find((item) => item.id === id)!;
    const kinds = kindsFor(next);
    const kind = kinds.includes(draft.kind) ? draft.kind : kinds[0];
    const metrics = metricsFor(next, kind);
    const metric = metrics.includes(draft.metric) ? draft.metric : metrics[0];
    const kept = { kind, period: draft.period, metric };
    const exists =
      kind !== 'cumulative' &&
      goals.some(
        (other) =>
          other.tracker_id === id &&
          other.kind === kind &&
          other.period === (kind === 'frequency' ? 'week' : draft.period) &&
          other.metric === metric,
      );
    setTrackerId(id);
    setDraft({ ...retarget(exists ? freeGoal(next, id, goals) : kept), pin: false });
  }

  function chooseKind(kind: GoalKind) {
    setDraft(retarget({ kind, period: draft.period, metric: metricsFor(tracker, kind)[0] }));
  }

  const target: number | null = (() => {
    if (draft.kind === 'frequency') {
      return draft.steps;
    }
    const value = parseTarget(draft.amount, draft.metric);
    return value === null ? null : toCanonical(draft.metric, value, text.distanceUnit);
  })();
  const targetError =
    target === null || target < 1
      ? t(draft.metric === 'distance' ? 'goals.form.errors.target' : 'goals.form.errors.targetWhole')
      : target > MAX_TARGET
        ? t('goals.form.errors.targetTooBig')
        : undefined;
  const endDateError = draft.kind === 'cumulative' && draft.endDate < today && !editing ? t('goals.form.errors.endDate') : undefined;
  const nameError = draft.name.trim().length > 60 ? t('goals.form.errors.nameLong') : undefined;
  const twin = editing
    ? undefined
    : goals.find(
        (other) =>
          draft.kind !== 'cumulative' &&
          other.tracker_id === trackerId &&
          other.kind === draft.kind &&
          other.period === period &&
          other.metric === draft.metric,
      );
  const otherWeekly = goals.some((other) => other.tracker_id === trackerId && other.period === 'week' && other.id !== goal?.id);
  const offerPin = weekly && !twin && (editing ? !goal.is_pinned : otherWeekly);

  const submit = useExclusive(async () => {
    setTried(true);
    if (targetError || endDateError || nameError || twin || target === null) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (goal) {
        const body: GoalUpdate = {};
        if (target !== goal.target) {
          body.target = target;
        }
        if (draft.kind === 'cumulative') {
          const name = draft.name.trim() || null;
          if (name !== goal.name) {
            body.name = name;
          }
          if (draft.endDate !== goal.end_date) {
            body.end_date = draft.endDate;
          }
        }
        if (draft.pin) {
          body.is_pinned = true;
        }
        if (Object.keys(body).length > 0) {
          await updateGoal(goal.id, body);
        }
      } else {
        const body: GoalCreate = { tracker_id: trackerId, kind: draft.kind, metric: draft.metric, target };
        if (period) {
          body.period = period;
        }
        if (draft.kind === 'cumulative') {
          body.end_date = draft.endDate;
          body.name = draft.name.trim() || null;
        }
        if (draft.pin) {
          body.is_pinned = true;
        }
        await createGoal(body);
      }
      leave();
      await refreshAccountData(queryClient);
    } catch (failure) {
      setError(failureKey(failure));
      setSaving(false);
    }
  });

  async function remove() {
    if (!goal) {
      return;
    }
    try {
      await deleteGoal(goal.id);
      setDeleting(false);
      leave();
      await refreshAccountData(queryClient);
    } catch (failure) {
      setDeleting(false);
      setError(failureKey(failure));
    }
  }

  const metrics = metricsFor(tracker, draft.kind);
  const unit = text.targetUnit(draft.kind, draft.period, draft.metric, tracker);
  const hint = t(`goals.form.${editing ? 'changeHint' : 'hints'}.${period ?? 'cumulative'}`);

  const targetField = (
    <TextField
      label={t('goals.form.target', { unit })}
      value={draft.amount}
      onChangeText={(amount) => setDraft({ ...draft, amount })}
      error={tried ? targetError : undefined}
      keyboardType={draft.metric === 'distance' ? 'decimal-pad' : 'number-pad'}
      inputMode={draft.metric === 'distance' ? 'decimal' : 'numeric'}
      maxLength={12}
    />
  );

  const fields = (
    <Card style={{ gap: space[24], padding: space[24] }}>
      <Text variant="h2" accessibilityRole="header">
        {goal ? text.title(goal, tracker) : t('goals.form.intention')}
      </Text>
      {editing ? (
        <>
          <ReadOnly label={t('goals.form.tracker')} value={tracker.name} />
          <ReadOnly
            label={t('goals.form.kind')}
            value={`${t(`goals.kinds.${draft.kind}`)} · ${t(`goals.metrics.${draft.metric}`)}${period ? ` · ${t(`goals.periods.${period}`)}` : ''}`}
          />
        </>
      ) : (
        <>
          <SelectField
            label={t('goals.form.tracker')}
            value={trackerId}
            onChange={chooseTracker}
            options={trackers.map((item) => ({ value: item.id, label: item.name }))}
          />
          <View style={{ gap: space[8] }}>
            <Segmented
              label={t('goals.form.kind')}
              value={draft.kind}
              onChange={chooseKind}
              options={kindsFor(tracker).map((kind) => ({ value: kind, label: t(`goals.kinds.${kind}`) }))}
            />
            <Text variant="caption" tone="muted">
              {t(`goals.kindHints.${draft.kind}`)}
            </Text>
          </View>
          {draft.kind === 'amount' ? (
            <View style={{ gap: space[8] }}>
              <Text variant="smallMedium" aria-hidden>
                {t('goals.form.period')}
              </Text>
              <Segmented
                label={t('goals.form.period')}
                value={draft.period}
                onChange={(next) => setDraft(retarget({ kind: draft.kind, period: next, metric: draft.metric }))}
                options={(['day', 'week'] as const).map((value) => ({ value, label: t(`goals.periods.${value}`) }))}
              />
            </View>
          ) : null}
          {metrics.length > 1 ? (
            <View style={{ gap: space[8] }}>
              <Text variant="smallMedium" aria-hidden>
                {t('goals.form.metric')}
              </Text>
              <Segmented
                label={t('goals.form.metric')}
                value={draft.metric}
                onChange={(next) => setDraft(retarget({ kind: draft.kind, period: draft.period, metric: next }))}
                options={metrics.map((value) => ({
                  value,
                  label: value === 'count' ? (tracker.counter_unit ?? t('goals.metrics.count')) : t(`goals.metrics.${value}`),
                }))}
              />
            </View>
          ) : null}
        </>
      )}
      {draft.kind === 'cumulative' ? (
        <TextField
          label={t('goals.form.name')}
          placeholder={t('goals.form.namePlaceholder')}
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          error={tried ? nameError : undefined}
          maxLength={80}
        />
      ) : null}
      {draft.kind === 'frequency' ? (
        <Stepper
          value={draft.steps}
          unit={t('goals.weekly.sessions', { count: draft.steps })}
          canDecrease={draft.steps > FREQUENCY.min}
          canIncrease={draft.steps < FREQUENCY.max}
          decreaseLabel={t('goals.form.decrease')}
          increaseLabel={t('goals.form.increase')}
          onChange={(direction) => setDraft({ ...draft, steps: draft.steps + direction })}
        />
      ) : draft.kind === 'cumulative' ? (
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: compact ? space[24] : space[16] }}>
          <View style={compact ? undefined : { flex: 1 }}>{targetField}</View>
          <View style={compact ? undefined : { flex: 1 }}>
            <DateField
              label={t('goals.form.endDate')}
              value={draft.endDate}
              minimum={editing && goal.start_date < today ? goal.start_date : today}
              doneLabel={t('goals.form.dateDone')}
              error={tried ? endDateError : undefined}
              onChange={(endDate) => setDraft({ ...draft, endDate })}
            />
          </View>
        </View>
      ) : (
        targetField
      )}
      <Text variant="small" tone="muted">
        {hint}
      </Text>
      {offerPin ? (
        <CheckRow
          label={t('goals.form.pin')}
          hint={t('goals.form.pinHint')}
          checked={draft.pin}
          onToggle={() => setDraft({ ...draft, pin: !draft.pin })}
        />
      ) : null}
      {editing && weekly && goal.is_pinned ? (
        <Text variant="caption" tone="muted">
          {t('goals.form.pinned')}
        </Text>
      ) : null}
      {twin ? (
        <View>
          <Notice tone="info" title={t('goals.form.errors.exists')} />
          <TextLink
            label={t('goals.form.openTwin')}
            align="start"
            onPress={() => router.replace({ pathname: '/profile/goals/[id]', params: { id: twin.id } })}
          />
        </View>
      ) : null}
      {error ? <Notice tone="error" title={t(error)} /> : null}
      <Button label={t(editing ? 'goals.form.save' : 'goals.form.submit')} onPress={submit} loading={saving} disabled={Boolean(twin)} />
      <Button label={t('goals.form.cancel')} variant="secondary" onPress={leave} disabled={saving} />
      {editing ? <Button label={t('goals.form.delete')} variant="ghost" onPress={() => setDeleting(true)} disabled={saving} /> : null}
      {deleting ? (
        <Sheet visible title={t('goals.delete.title')} onClose={() => setDeleting(false)}>
          <Text tone="muted">{t(weekly ? 'goals.delete.bodyStreak' : 'goals.delete.body')}</Text>
          <Button label={t('goals.delete.confirm')} variant="destructive" onPress={remove} />
          <Button label={t('goals.delete.cancel')} variant="secondary" onPress={() => setDeleting(false)} />
        </Sheet>
      ) : null}
    </Card>
  );

  return <Columns main={fields} side={<StreakCard />} />;
}

function useGoalPage(includeArchived: boolean) {
  const { t } = useTranslation();
  const back = useLeaveForm();
  const trackers = useListTrackers(includeArchived ? { include_archived: true } : undefined);
  const goals = useListGoals();
  const trackerItems = trackers.data?.status === 200 ? trackers.data.data.items : undefined;
  const goalItems = goals.data?.status === 200 ? goals.data.data.items : undefined;
  const pending = trackers.isPending || goals.isPending;
  const failed = !pending && (!trackerItems || !goalItems);
  const states = pending ? (
    <SkeletonCard label={t('goals.loading')} rows={3} />
  ) : failed ? (
    <ErrorCard
      message={t('goals.loadError')}
      retryLabel={t('goals.retry')}
      onRetry={() => {
        trackers.refetch();
        goals.refetch();
      }}
    />
  ) : null;
  return { back, trackerItems, goalItems, states };
}

/**
 * "Create a goal", for the tracker in `?tracker=`, else for the main tracker or the first one
 * that still lacks a weekly or daily goal, starting on a goal it does not have yet.
 */
export function NewGoalScreen() {
  const { t } = useTranslation();
  const { tracker: wanted } = useLocalSearchParams<{ tracker?: string }>();
  const me = useReadMe();
  const { back, trackerItems, goalItems, states } = useGoalPage(false);
  const mainId = me.data?.status === 200 ? me.data.data.main_tracker_id : null;

  let body = states;
  if (!states && trackerItems && goalItems) {
    const preferred = [mainId, ...trackerItems.map((item) => item.id)];
    const free = preferred.find((id) => {
      const item = trackerItems.find((candidate) => candidate.id === id);
      return item !== undefined && freeGoal(item, item.id, goalItems).kind !== 'cumulative';
    });
    const initial = [wanted, free, mainId, trackerItems[0]?.id].find((id) => trackerItems.some((item) => item.id === id));
    body = initial ? (
      <GoalForm trackers={trackerItems} goals={goalItems} initialTrackerId={initial} />
    ) : (
      <Notice tone="info" title={t('goals.noTrackers')} />
    );
  }
  return (
    <Screen title={t('goals.form.createTitle')} caption={t('goals.caption')} back={{ label: t('goals.back'), onPress: back }}>
      {body}
    </Screen>
  );
}

/** "Edit goal": the goal in the route, or a note when it no longer exists. */
export function EditGoalScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goal = useGetGoal(id);
  const { back, trackerItems, goalItems, states } = useGoalPage(true);
  const current = goal.data?.status === 200 ? goal.data.data : undefined;

  let body = states;
  if (!states && trackerItems && goalItems) {
    if (goal.isPending) {
      body = <SkeletonCard label={t('goals.loading')} rows={3} />;
    } else if (!current || !trackerItems.some((item) => item.id === current.tracker_id)) {
      body = <Notice tone="info" title={t('goals.form.errors.notFound')} />;
    } else {
      body = <GoalForm key={current.id} trackers={trackerItems} goals={goalItems} initialTrackerId={current.tracker_id} goal={current} />;
    }
  }
  return (
    <Screen title={t('goals.form.editTitle')} caption={t('goals.caption')} back={{ label: t('goals.back'), onPress: back }}>
      {body}
    </Screen>
  );
}
