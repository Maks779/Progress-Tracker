import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, View, type ViewStyle } from 'react-native';

import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { showFocusRing } from '@/shared/ui/focusRing';
import { IconButton } from '@/shared/ui/IconButton';
import { Ellipsis, Plus } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import type { DraftActions } from '../editor';
import { useWorkoutText } from '../format';
import { type DraftExercise, MAX_SETS, nextInSuperset, setNumber, setProblems } from '../rules';
import { COLUMN, SetRow } from './SetRow';

/** "+ Add set" under the rows: a dark full-width button, as in the design. */
export function AddRowButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      onPress={onPress}
      style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[8],
        minHeight: 44,
        borderRadius: radius[12],
        borderWidth: 1,
        borderColor: hovered ? colors.accent.fill : 'transparent',
        backgroundColor: colors.bg.base,
        opacity: pressed ? 0.8 : 1,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Plus color={colors.text.primary} size={20} strokeWidth={2} />
      <Text variant="smallStrong">{label}</Text>
    </Pressable>
  );
}

type BlockProps = {
  index: number;
  exercise: DraftExercise;
  exercises: DraftExercise[];
  name: string;
  actions: DraftActions;
  editing: boolean;
  showProblems: boolean;
  onMenu: () => void;
  onSetMenu: (setIndex: number) => void;
};

/**
 * Exercise block from the design: the name with its "⋯" menu, the column headings and a row per
 * set, then "Add set". A set that cannot be checked yet marks its empty fields and says why.
 * In a saved session being edited every set counts: there is no Previous or Done column, and
 * `showProblems` marks every set that cannot be saved.
 */
function ExerciseBlock({ index, exercise, exercises, name, actions, editing, showProblems, onMenu, onSetMenu }: BlockProps) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const text = useWorkoutText();
  const [attempted, setAttempted] = useState<string[]>([]);
  const highlight = editing ? null : nextInSuperset(exercises, index);
  const marked = (id: string) => showProblems || attempted.includes(id);
  const failing = exercise.sets.filter((set) => marked(set.id) && setProblems(set, exercise.weighted).length > 0);

  const toggle = (setIndex: number) => {
    const set = exercise.sets[setIndex];
    if (!set.done && setProblems(set, exercise.weighted).length > 0) {
      setAttempted((ids) => [...ids, set.id]);
      AccessibilityInfo.announceForAccessibility(t(exercise.weighted ? 'workout.set.needsWeight' : 'workout.set.needsReps'));
      return;
    }
    setAttempted((ids) => ids.filter((id) => id !== set.id));
    actions.toggleSet(index, setIndex);
  };
  const columns: { label: string; width?: number; flex?: number }[] = editing
    ? [
        { label: t('workout.columns.set'), width: COLUMN.set },
        { label: text.unitLabel, flex: 1 },
        { label: t('workout.columns.reps'), flex: 1 },
      ]
    : [
        { label: t('workout.columns.set'), width: COLUMN.set },
        { label: t('workout.columns.previous'), flex: 1 },
        { label: text.unitLabel, width: COLUMN.weight },
        { label: t('workout.columns.reps'), width: COLUMN.reps },
        { label: t('workout.columns.done'), width: COLUMN.done },
      ];

  return (
    <View style={{ gap: space[8] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <Text variant="h3" style={{ flex: 1 }} accessibilityRole="header">
          {name}
        </Text>
        <View style={{ marginVertical: -10, marginRight: -10 }}>
          <IconButton icon={Ellipsis} label={t('workout.exercise.menu', { name })} onPress={onMenu} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: COLUMN.gap }} importantForAccessibility="no-hide-descendants" aria-hidden>
        {columns.map((column) => (
          <Text
            key={column.label}
            variant="caption"
            tone="muted"
            numberOfLines={1}
            style={{
              width: column.width,
              flex: column.flex,
              textAlign: column.width === COLUMN.set || (column.flex && !editing) ? 'left' : 'center',
            }}
          >
            {column.label}
          </Text>
        ))}
      </View>
      {exercise.sets.map((set, setIndex) => {
        const number = setNumber(exercise.sets, setIndex);
        const label = number === null ? t('workout.set.warmupShort') : String(number);
        const setName = number === null ? t('workout.set.warmupName') : t('workout.set.name', { number });
        return (
          <SetRow
            key={set.id}
            set={set}
            label={label}
            name={`${name}, ${setName}`}
            previous={exercise.previous[setIndex]}
            highlighted={set.id === highlight}
            editing={editing}
            problems={marked(set.id) ? setProblems(set, exercise.weighted) : []}
            onWeight={(kg) => actions.setWeight(index, setIndex, kg)}
            onReps={(reps) => actions.setReps(index, setIndex, reps)}
            onToggle={() => toggle(setIndex)}
            onMenu={() => onSetMenu(setIndex)}
          />
        );
      })}
      {failing.length > 0 ? (
        <Text variant="caption" tone="error" accessibilityLiveRegion="polite">
          {t(exercise.weighted ? 'workout.set.needsWeight' : 'workout.set.needsReps')}
        </Text>
      ) : null}
      {exercise.sets.length < MAX_SETS ? <AddRowButton label={t('workout.exercise.addSet')} onPress={() => actions.addSet(index)} /> : null}
    </View>
  );
}

type Props = {
  /** The indexes of the exercises in this card: one, or every exercise of a superset. */
  members: number[];
  exercises: DraftExercise[];
  nameOf: (exercise: DraftExercise) => string;
  actions: DraftActions;
  /** A saved session being edited rather than the active workout. */
  editing?: boolean;
  showProblems?: boolean;
  onMenu: (index: number) => void;
  onSetMenu: (index: number, setIndex: number) => void;
};

/**
 * A card with one exercise, or with every exercise of a superset (agreed with the owner,
 * 2026-11-26): "Superset" above them and an accent bar on the left, one block per exercise.
 */
export function ExerciseCard({ members, exercises, nameOf, actions, editing = false, showProblems = false, onMenu, onSetMenu }: Props) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const wide = useBreakpoint() !== 'compact';
  const superset = members.length > 1;
  const names = members.map((member) => nameOf(exercises[member]));
  return (
    <View
      role={superset ? 'group' : undefined}
      aria-label={superset ? t('workout.superset.label', { names: names.join(' + ') }) : undefined}
      style={{
        backgroundColor: colors.bg.surface,
        borderColor: colors.border.default,
        borderWidth: 1,
        borderRadius: radius[16],
        overflow: 'hidden',
        padding: wide ? space[24] : 12,
        paddingLeft: superset ? (wide ? space[24] : 12) + 3 : undefined,
        gap: space[16],
      }}
    >
      {superset ? (
        <>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.accent.fill }} />
          <Text variant="captionStrong" tone="accent" style={{ textTransform: 'uppercase', marginBottom: -space[8] }}>
            {t('workout.superset.title')}
          </Text>
        </>
      ) : null}
      {members.map((member, position) => (
        <Fragment key={exercises[member].id}>
          {position > 0 ? <View style={{ height: 1, backgroundColor: colors.border.default }} /> : null}
          <ExerciseBlock
            index={member}
            exercise={exercises[member]}
            exercises={exercises}
            name={names[position]}
            actions={actions}
            editing={editing}
            showProblems={showProblems}
            onMenu={() => onMenu(member)}
            onSetMenu={(setIndex) => onSetMenu(member, setIndex)}
          />
        </Fragment>
      ))}
    </View>
  );
}
