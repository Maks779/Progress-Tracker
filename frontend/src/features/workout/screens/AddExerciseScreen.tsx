import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import type { ExerciseOut } from '@/shared/api/generated/model';
import { parseIsoDate } from '@/shared/format/dates';
import { useSideColumn } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ChipGroup } from '@/shared/ui/Chips';
import { Columns } from '@/shared/ui/Columns';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Check, CircleCheck, Dumbbell, Plus, Search } from '@/shared/ui/icons';
import { Screen } from '@/shared/ui/Screen';
import { ErrorCard, SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';

import { CustomExerciseSheet } from '../components/CustomExerciseSheet';
import { NoWorkout } from '../components/NoWorkout';
import { Elapsed } from '../components/Timers';
import {
  exerciseName,
  filterExercises,
  infoOf,
  isWeighted,
  lastSetsOf,
  MUSCLE_GROUPS,
  type MuscleGroup,
  useExerciseCatalog,
} from '../exercises';
import { MAX_EXERCISES, type WorkoutDraft } from '../rules';
import { useActiveDraft } from '../start';
import { type NewExercise, useWorkout, workout } from '../store';

type RowProps = { exercise: ExerciseOut; name: string; selected: boolean; disabled: boolean; onPress: () => void };

/** A catalog row: the exercise, its muscle group and equipment (and when it was last done), + or ✓. */
function ExerciseRow({ exercise, name, selected, disabled, onPress }: RowProps) {
  const { t, i18n } = useTranslation();
  const { colors, radius, space } = useTheme();
  const parts = [t(`exercises.muscle.${exercise.muscle_group}`), t(`exercises.equipment.${exercise.equipment}`)];
  if (exercise.last_used_date) {
    const date = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(parseIsoDate(exercise.last_used_date));
    parts.push(t('workout.picker.lastUsed', { date }));
  } else if (exercise.is_custom) {
    parts.push(t('workout.picker.custom'));
  }
  const Mark = selected ? CircleCheck : Plus;
  return (
    <Pressable
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled}
      aria-label={`${name}, ${parts.join(', ')}`}
      onPress={disabled ? undefined : onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[16],
        minHeight: 80,
        paddingHorizontal: space[8],
        borderRadius: radius[12],
        backgroundColor: selected ? colors.accent.subtle : hovered && !disabled ? colors.bg.surfaceRaised : 'transparent',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'auto' : 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Dumbbell color={colors.accent.text} size={24} strokeWidth={1.75} />
      <View style={{ flex: 1, paddingVertical: space[8] }}>
        <Text variant="smallStrong">{name}</Text>
        <Text variant="caption" tone="muted">
          {parts.join(' · ')}
        </Text>
      </View>
      <Mark color={selected ? colors.accent.text : colors.text.primary} size={22} strokeWidth={1.75} />
    </Pressable>
  );
}

/**
 * Add exercise (design: Workout / Exercise picker): search by name in the UI language, filter
 * by muscle group, pick one or more, and add them at the end of the workout, each with its
 * rows and ghost values from the last time it was done. What the catalog lacks can be created.
 * The Add button stays in reach below the list (in the side card when there is one).
 */
export function AddExerciseScreen() {
  const draft = useActiveDraft();
  return draft ? <Picker draft={draft} /> : <NoWorkout />;
}

function Picker({ draft }: { draft: WorkoutDraft }) {
  const { t, i18n } = useTranslation();
  const { colors, space } = useTheme();
  const twoColumns = useSideColumn(false) !== null;
  const catalog = useExerciseCatalog();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const room = MAX_EXERCISES - draft.exercises.length;
  const nameOf = (exercise: ExerciseOut) => exerciseName(exercise, t);
  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : ids.length < room ? [...ids, id] : ids));
  const back = () => router.dismissTo('/workout');

  const add = async () => {
    const items: NewExercise[] = await Promise.all(
      selected.map(async (id) => {
        const exercise = catalog.byId.get(id);
        return { exerciseId: id, info: infoOf(exercise), weighted: isWeighted(exercise), previous: await lastSetsOf(id) };
      }),
    );
    if (useWorkout.getState().draft) {
      workout.addExercises(items);
    }
    back();
  };

  let list;
  if (catalog.query.isPending) {
    list = <SkeletonCard label={t('workout.picker.loading')} rows={4} />;
  } else if (!catalog.items) {
    list = (
      <ErrorCard
        title={t('workout.picker.loadErrorTitle')}
        message={t('workout.picker.loadError')}
        retryLabel={t('home.retry')}
        onRetry={() => catalog.query.refetch()}
      />
    );
  } else {
    const found = filterExercises(catalog.items, query, muscle, nameOf, i18n.language);
    list = (
      <View>
        {found.map((exercise) => {
          const isSelected = selected.includes(exercise.id);
          return (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              name={nameOf(exercise)}
              selected={isSelected}
              disabled={!isSelected && selected.length >= room}
              onPress={() => toggle(exercise.id)}
            />
          );
        })}
        {found.length === 0 ? (
          <Text variant="small" tone="muted" style={{ paddingVertical: space[16] }} accessibilityLiveRegion="polite">
            {query.trim() ? t('workout.picker.noMatch', { query: query.trim() }) : t('workout.picker.noneInGroup')}
          </Text>
        ) : null}
        <Button
          label={query.trim() && found.length === 0 ? t('workout.picker.createNamed', { name: query.trim() }) : t('workout.picker.create')}
          variant={found.length === 0 ? 'secondary' : 'ghost'}
          onPress={() => setCreating(query.trim())}
        />
      </View>
    );
  }

  const picker = (
    <Card style={{ padding: space[24], gap: space[16] }}>
      <Text variant="h2" accessibilityRole="header">
        {t('workout.picker.title')}
      </Text>
      <TextField
        label={t('workout.picker.search')}
        icon={Search}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      <ChipGroup
        scroll
        label={t('workout.picker.muscle')}
        value={muscle}
        onChange={setMuscle}
        options={[
          { value: 'all' as const, label: t('workout.picker.all') },
          ...MUSCLE_GROUPS.map((value) => ({ value, label: t(`exercises.muscle.${value}`), icon: Dumbbell })),
        ]}
      />
      {list}
    </Card>
  );
  const addButton = (
    <Button
      label={selected.length > 1 ? t('workout.picker.addMany', { count: selected.length }) : t('workout.picker.addOne')}
      disabled={selected.length === 0}
      onPress={add}
    />
  );
  const side = (
    <Card style={{ padding: space[16], gap: space[8] }}>
      <Text variant="h3">{t('workout.picker.sideTitle')}</Text>
      <Text variant="small" tone="muted">
        {room > 0 ? t('workout.picker.sideBody') : t('workout.picker.full', { count: MAX_EXERCISES })}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
        {selected.map((id) => (
          <Badge
            key={id}
            icon={Check}
            color={colors.accent.text}
            label={t('workout.picker.selected', { name: exerciseName(catalog.byId.get(id), t) })}
          />
        ))}
      </View>
      {addButton}
    </Card>
  );

  return (
    <>
      <Screen
        title={t('workout.addExercise')}
        caption={<Elapsed startedAt={draft.startedAt} prefix={draft.name} />}
        back={{ label: t('nav.workout'), onPress: back }}
        footer={twoColumns ? undefined : addButton}
      >
        <Columns main={picker} side={twoColumns ? side : undefined} />
      </Screen>
      {creating !== null ? (
        <CustomExerciseSheet
          userId={draft.userId}
          name={creating}
          muscle={muscle === 'all' ? 'chest' : muscle}
          onClose={() => setCreating(null)}
          onCreated={(exercise) => {
            setCreating(null);
            setQuery('');
            setMuscle('all');
            setSelected((ids) => (ids.length < room ? [...ids, exercise.id] : ids));
          }}
        />
      ) : null}
    </>
  );
}
