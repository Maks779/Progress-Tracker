import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Check } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import { useWorkoutText } from '../format';
import {
  cleanRepsText,
  cleanWeightText,
  type DraftSet,
  effective,
  parseWeight,
  type PreviousSet,
  type SetProblem,
} from '../rules';

export const COLUMN = { set: 24, weight: 64, reps: 48, done: 44, gap: 8 };

type FieldProps = {
  label: string;
  value: number | null;
  ghost: number | null;
  format: (value: number) => string;
  clean: (text: string) => string;
  parse: (text: string) => number | null | undefined;
  onChange: (value: number | null) => void;
  width: number;
  locked: boolean;
  invalid: boolean;
  keyboard: 'decimal-pad' | 'number-pad';
};

/**
 * A number in a set row. While it has focus it shows what is typed ("62." is not a number
 * yet), and the draft gets every readable value at once; otherwise it shows the draft's value.
 * Empty, it shows the ghost value of last time.
 */
function NumberField({ label, value, ghost, format, clean, parse, onChange, width, locked, invalid, keyboard }: FieldProps) {
  const { colors, radius, typography } = useTheme();
  const [editing, setEditing] = useState<string | null>(null);
  const shown = value === null ? '' : format(value);
  const text = editing ?? shown;
  const focused = editing !== null;

  const borderColor = invalid ? colors.state.error : focused ? colors.accent.fill : 'transparent';
  return (
    <TextInput
      accessibilityLabel={label}
      value={text}
      placeholder={ghost === null ? (locked ? '—' : '') : format(ghost)}
      placeholderTextColor={colors.text.muted}
      editable={!locked}
      keyboardType={keyboard}
      inputMode={keyboard === 'decimal-pad' ? 'decimal' : 'numeric'}
      selectTextOnFocus
      maxLength={7}
      onFocus={() => setEditing(shown)}
      onBlur={() => setEditing(null)}
      onChangeText={(raw) => {
        const next = clean(raw);
        setEditing(next);
        const parsed = parse(next);
        if (parsed !== undefined) {
          onChange(parsed);
        }
      }}
      style={{
        width,
        height: 44,
        borderRadius: radius[8],
        borderWidth: 1,
        borderColor,
        backgroundColor: colors.bg.surfaceRaised,
        color: colors.text.primary,
        fontFamily: typography.body.fontFamily,
        fontSize: typography.body.fontSize,
        fontVariant: ['tabular-nums'],
        textAlign: 'center',
        padding: 0,
        outlineStyle: 'solid',
        outlineWidth: 0,
      }}
    />
  );
}

type Props = {
  set: DraftSet;
  /** "1", "2", … for working sets, "W" for warm-ups. */
  label: string;
  /** The set's number for screen readers ("Set 2", "Warm-up set"). */
  name: string;
  previous: PreviousSet | undefined;
  highlighted: boolean;
  problems: SetProblem[];
  onWeight: (kg: number | null) => void;
  onReps: (reps: number | null) => void;
  onToggle: () => void;
  onMenu: () => void;
};

/**
 * One row of an exercise, as in the design: set number, last time's set (ghosted), weight and
 * reps, and the 44 px done box. A done row is tinted and its fields are locked until it is
 * unchecked, so a tired thumb cannot change a finished set by accident.
 */
export function SetRow({ set, label, name, previous, highlighted, problems, onWeight, onReps, onToggle, onMenu }: Props) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const text = useWorkoutText();
  const values = effective(set);
  const weightGhost = set.ghost?.weightKg ?? null;
  const repsGhost = set.ghost?.reps ?? null;
  const parseReps = (input: string) => (input === '' ? null : Number(input));

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: COLUMN.gap,
        minHeight: 44,
        borderRadius: radius[8],
        borderWidth: 1,
        borderColor: highlighted ? colors.accent.fill : 'transparent',
        backgroundColor: set.done ? colors.accent.subtle : 'transparent',
      }}
    >
      <Pressable
        role="button"
        aria-label={t('workout.set.menu', { set: name })}
        onPress={onMenu}
        hitSlop={4}
        style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
          width: COLUMN.set,
          height: 44,
          paddingLeft: 8,
          justifyContent: 'center',
          borderRadius: radius[8],
          backgroundColor: hovered ? colors.bg.surfaceRaised : 'transparent',
          cursor: 'pointer',
          outlineStyle: 'solid',
          outlineWidth: showFocusRing(focused) ? 2 : 0,
          outlineColor: colors.accent.fill,
        })}
      >
        <Text variant={set.kind === 'warmup' ? 'smallStrong' : 'small'} tone={set.kind === 'warmup' ? 'accent' : 'primary'} style={{ fontVariant: ['tabular-nums'] }}>
          {label}
        </Text>
      </Pressable>
      <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
        {text.previous(previous)}
      </Text>
      <NumberField
        label={t('workout.set.weight', { set: name, unit: text.unitLabel })}
        value={set.done ? values.weightKg : set.weightKg}
        ghost={weightGhost}
        format={text.fieldWeight}
        clean={cleanWeightText}
        parse={(input) => parseWeight(input, text.unit)}
        onChange={onWeight}
        width={COLUMN.weight}
        locked={set.done}
        invalid={problems.includes('weightRequired') || problems.includes('weightRange')}
        keyboard="decimal-pad"
      />
      <NumberField
        label={t('workout.set.reps', { set: name })}
        value={set.done ? values.reps : set.reps}
        ghost={repsGhost}
        format={String}
        clean={cleanRepsText}
        parse={parseReps}
        onChange={onReps}
        width={COLUMN.reps}
        locked={set.done}
        invalid={problems.includes('repsRequired') || problems.includes('repsRange')}
        keyboard="number-pad"
      />
      <Pressable
        role="checkbox"
        aria-checked={set.done}
        aria-label={t('workout.set.done', { set: name })}
        onPress={onToggle}
        style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
          width: COLUMN.done,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius[8],
          backgroundColor: hovered && !set.done ? colors.bg.surfaceRaised : 'transparent',
          cursor: 'pointer',
          outlineStyle: 'solid',
          outlineWidth: showFocusRing(focused) ? 2 : 0,
          outlineColor: colors.accent.fill,
        })}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: set.done ? colors.accent.fill : colors.text.muted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {set.done ? <Check color={colors.accent.text} size={16} strokeWidth={2.5} /> : null}
        </View>
      </Pressable>
    </View>
  );
}
