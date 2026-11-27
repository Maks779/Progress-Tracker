import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { deliverSession, removeItem, sessionKey } from '@/features/outbox/outbox';
import { useOffline } from '@/shared/api/connection';
import { useNow } from '@/shared/hooks/useNow';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Dumbbell, Flame, Link2, Pencil, Trash2, TriangleAlert, Unlink2 } from '@/shared/ui/icons';
import { type MenuItem, MenuSheet } from '@/shared/ui/MenuSheet';
import { Notice } from '@/shared/ui/Notice';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';

import { useWorkoutText } from '../format';
import { durationSeconds, tally, toSession, type WorkoutDraft } from '../rules';
import { workout } from '../store';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="h2" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

type FinishProps = { draft: WorkoutDraft; trackerName: string; exerciseNames: string[]; onClose: () => void };

/**
 * "Finish this workout?": what will be saved and what will not count, then the save. Only
 * checked sets are sent, through the outbox: without a connection the session waits on the
 * device and Summary opens anyway. When the server refuses it (its tracker was deleted
 * meanwhile), the workout stays open.
 */
export function FinishSheet({ draft, trackerName, exerciseNames, onClose }: FinishProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const text = useWorkoutText();
  const offline = useOffline();
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const counts = tally(draft.exercises);
  const elapsed = text.clock(durationSeconds(draft.startedAt, now));
  const used = exerciseNames.filter((_, index) => draft.exercises[index].sets.some((set) => set.done));

  const finish = async () => {
    const body = toSession(draft, Date.now());
    if (!body) {
      return;
    }
    setError(null);
    const result = await deliverSession(draft.id, draft.userId, body);
    if (result.status === 'refused') {
      await removeItem(sessionKey(draft.id));
      setError(t(result.code === 'tracker_gone' ? 'workout.finish.trackerGone' : 'workout.finish.failed'));
      return;
    }
    workout.finished({
      userId: draft.userId,
      trackerName,
      sessionId: draft.id,
      body,
      saved: result.status === 'saved' ? result.data : null,
    });
  };

  let body: string;
  if (counts.done === 0) {
    body = t('workout.finish.nothing');
  } else if (counts.open === 0) {
    body = t('workout.finish.all', { count: counts.done });
  } else {
    body = t('workout.finish.some', { count: counts.done, open: t('workout.finish.open', { count: counts.open }) });
  }

  return (
    <Sheet visible title={t('workout.finish.title')} onClose={onClose}>
      <View style={{ gap: space[8], padding: space[16], borderRadius: radius[12], backgroundColor: colors.bg.surfaceRaised }}>
        <View style={{ flexDirection: 'row', gap: space[16] }}>
          <Stat label={t('workout.stats.elapsed')} value={elapsed} />
          <Stat label={t('workout.stats.completed')} value={t('workout.stats.sets', { count: counts.done })} />
        </View>
        {used.length > 0 ? (
          <Text variant="small" tone="muted">
            {used.join(' · ')}
          </Text>
        ) : null}
      </View>
      <Text variant="small" tone="muted">
        {body}
      </Text>
      {offline && counts.done > 0 ? <Notice tone="info" title={t('workout.finish.offlineTitle')} message={t('workout.finish.offlineBody')} /> : null}
      {error ? <Notice tone="error" title={error} /> : null}
      {counts.done > 0 ? <Button label={t('workout.finish.confirm')} onPress={finish} /> : null}
      <Button label={t('workout.keepTraining')} variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

/** "Discard this workout?": nothing of it was saved yet, so it is gone for good. */
export function DiscardSheet({ onDiscard, onClose }: { onDiscard: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Sheet visible title={t('workout.discard.title')} onClose={onClose}>
      <View style={{ flexDirection: 'row', gap: space[8] }}>
        <TriangleAlert color={colors.state.error} size={20} strokeWidth={1.75} />
        <Text variant="small" tone="muted" style={{ flex: 1 }}>
          {t('workout.discard.body')}
        </Text>
      </View>
      <Button label={t('workout.discard.confirm')} variant="destructive" onPress={onDiscard} />
      <Button label={t('workout.keepTraining')} variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

/** The workout's name, which the session keeps ("Upper body A"). */
export function RenameSheet({ name, onClose }: { name: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | undefined>();
  const save = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(t('workout.rename.required'));
      return;
    }
    workout.rename(trimmed);
    onClose();
  };
  return (
    <Sheet visible title={t('workout.rename.title')} onClose={onClose}>
      <TextField
        label={t('workout.rename.label')}
        value={value}
        onChangeText={(next) => {
          setValue(next);
          setError(undefined);
        }}
        maxLength={60}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
        error={error}
      />
      <Button label={t('workout.rename.save')} onPress={save} />
      <Button label={t('workout.rename.cancel')} variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

/** The workout's "⋯" on phones and tablets: rename, and Discard (design review #26). */
export function WorkoutMenu({ onRename, onDiscard, onClose }: { onRename: () => void; onDiscard: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <MenuSheet
      title={t('workout.menu.title')}
      onClose={onClose}
      items={[
        { label: t('workout.menu.rename'), icon: Pencil, onPress: onRename },
        { label: t('workout.discard.confirm'), icon: Trash2, destructive: true, onPress: onDiscard },
      ]}
    />
  );
}

type ExerciseMenuProps = {
  draft: WorkoutDraft;
  index: number;
  name: string;
  nextName: string | undefined;
  onClose: () => void;
};

/**
 * An exercise's "⋯": superset with the next exercise or leave the superset, and remove. An
 * exercise with checked sets asks first, because those sets would go with it.
 */
export function ExerciseMenu({ draft, index, name, nextName, onClose }: ExerciseMenuProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const exercise = draft.exercises[index];
  const next = draft.exercises[index + 1];
  const checked = exercise?.sets.filter((set) => set.done).length ?? 0;
  if (!exercise) {
    return null;
  }
  const remove = () => {
    workout.removeExercise(index);
    onClose();
  };
  if (confirming) {
    return (
      <Sheet visible title={t('workout.exercise.removeTitle', { name })} onClose={onClose}>
        <Text variant="small" tone="muted">
          {t('workout.exercise.removeBody', { count: checked })}
        </Text>
        <Button label={t('workout.exercise.remove')} variant="destructive" onPress={remove} />
        <Button label={t('workout.exercise.keep')} variant="secondary" onPress={onClose} />
      </Sheet>
    );
  }
  const items: MenuItem[] = [];
  if (next && (exercise.group === null || next.group !== exercise.group)) {
    items.push({
      label: t('workout.superset.join'),
      hint: nextName,
      icon: Link2,
      onPress: () => {
        workout.groupWithNext(index);
        onClose();
      },
    });
  }
  if (exercise.group !== null) {
    items.push({
      label: t('workout.superset.leave'),
      icon: Unlink2,
      onPress: () => {
        workout.leaveGroup(index);
        onClose();
      },
    });
  }
  items.push({
    label: t('workout.exercise.remove'),
    icon: Trash2,
    destructive: true,
    onPress: () => (checked > 0 ? setConfirming(true) : remove()),
  });
  return <MenuSheet title={name} items={items} onClose={onClose} />;
}

type SetMenuProps = { draft: WorkoutDraft; index: number; setIndex: number; title: string; onClose: () => void };

/** A set's menu, behind its number: warm-up or working set, and remove. */
export function SetMenu({ draft, index, setIndex, title, onClose }: SetMenuProps) {
  const { t } = useTranslation();
  const set = draft.exercises[index]?.sets[setIndex];
  if (!set) {
    return null;
  }
  const warmup = set.kind === 'warmup';
  return (
    <MenuSheet
      title={title}
      onClose={onClose}
      items={[
        {
          label: t(warmup ? 'workout.set.makeWorking' : 'workout.set.makeWarmup'),
          hint: warmup ? undefined : t('workout.set.warmupHint'),
          icon: warmup ? Dumbbell : Flame,
          onPress: () => {
            workout.setKind(index, setIndex, warmup ? 'working' : 'warmup');
            onClose();
          },
        },
        {
          label: t('workout.set.remove'),
          icon: Trash2,
          destructive: true,
          onPress: () => {
            workout.removeSet(index, setIndex);
            onClose();
          },
        },
      ]}
    />
  );
}
