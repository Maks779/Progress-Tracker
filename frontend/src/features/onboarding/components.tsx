import { useTranslation } from 'react-i18next';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { Card } from '@/shared/ui/Card';
import { showFocusRing } from '@/shared/ui/focusRing';
import {
  Activity,
  BookOpen,
  Dumbbell,
  Flame,
  type LucideIcon,
  Minus,
  Plus,
  Sparkles,
  Square,
  SquareCheck,
} from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import { RULES, type TrackerKind } from './plan';

export const KIND_ICONS: Record<TrackerKind, LucideIcon> = {
  strength: Dumbbell,
  cardio: Activity,
  reading: BookOpen,
  general: Sparkles,
};

/** "3 sessions / week" with the right plural in every language. */
export function useTargetLabel() {
  const { t } = useTranslation();
  return (kind: TrackerKind, count: number) => t(`onboarding.units.${RULES[kind].metric}`, { count });
}

type ChoiceProps = { kind: TrackerKind; checked: boolean; onToggle: () => void };

/** One tracker type in step 1: a card that works as a checkbox. */
export function ChoiceCard({ kind, checked, onToggle }: ChoiceProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const Icon = KIND_ICONS[kind];
  const Box = checked ? SquareCheck : Square;
  const title = t(`onboarding.kinds.${kind}.title`);
  const body = t(`onboarding.kinds.${kind}.body`);
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={`${title}, ${body}`}
      onPress={onToggle}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[16],
        minHeight: 72,
        paddingHorizontal: space[16],
        borderRadius: radius[16],
        borderWidth: 1,
        borderColor: checked ? colors.accent.fill : colors.border.default,
        backgroundColor: checked ? colors.accent.subtle : hovered ? colors.bg.surfaceRaised : colors.bg.surface,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Icon color={checked ? colors.accent.text : colors.text.muted} size={24} strokeWidth={1.75} />
      <View style={{ flex: 1, paddingVertical: space[8] }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {body}
        </Text>
      </View>
      <Box color={checked ? colors.accent.text : colors.text.muted} size={22} strokeWidth={1.75} />
    </Pressable>
  );
}

function StepButton({ label, icon: Icon, disabled, onPress }: { label: string; icon: LucideIcon; disabled: boolean; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius[12],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: hovered && !disabled ? colors.bg.base : colors.bg.surfaceRaised,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'auto' : 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Icon color={colors.text.primary} size={20} strokeWidth={2} />
    </Pressable>
  );
}

type GoalProps = { kind: TrackerKind; name: string; value: number; onChange: (direction: 1 | -1) => void };

/**
 * Step 2: the weekly target of one tracker, with − and + and a bar for how big it is. The
 * title names the type and the tracker ("Strength · Gym"), or just one when they match.
 */
export function GoalCard({ kind, name, value, onChange }: GoalProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const label = useTargetLabel();
  const rule = RULES[kind];
  const kindTitle = t(`onboarding.kinds.${kind}.title`);
  const title = name === kindTitle ? kindTitle : `${kindTitle} · ${name}`;
  return (
    <Card style={{ gap: space[16], padding: space[24] }}>
      <Text variant="smallStrong">{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <StepButton
          label={`${t('onboarding.goal.decrease')}: ${title}`}
          icon={Minus}
          disabled={value <= rule.min}
          onPress={() => onChange(-1)}
        />
        <View style={{ alignItems: 'center' }} aria-live="polite">
          <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
            {value}
          </Text>
          <Text variant="small" tone="muted">
            {label(kind, value)}
          </Text>
        </View>
        <StepButton
          label={`${t('onboarding.goal.increase')}: ${title}`}
          icon={Plus}
          disabled={value >= rule.max}
          onPress={() => onChange(1)}
        />
      </View>
      <View style={{ height: 6, borderRadius: radius.full, backgroundColor: colors.bg.surfaceRaised }}>
        <View
          style={{
            width: `${Math.round((value / rule.max) * 100)}%`,
            height: 6,
            borderRadius: radius.full,
            backgroundColor: colors.accent.fill,
          }}
        />
      </View>
    </Card>
  );
}

/** Step 2: why weekly goals and not daily ones. */
export function StreakNote() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Card style={{ gap: space[8], padding: space[24] }}>
      <Flame color={colors.accent.text} size={22} strokeWidth={1.75} />
      <Text variant="bodyStrong">{t('onboarding.goal.streakTitle')}</Text>
      <Text variant="small" tone="muted">
        {t('onboarding.goal.streakBody')}
      </Text>
    </Card>
  );
}

type LineupProps = { items: { kind: TrackerKind; name: string; target: number }[] };

/** Step 3: what was created, as small chips. */
export function Lineup({ items }: LineupProps) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const label = useTargetLabel();
  return (
    <Card style={{ gap: space[16], padding: space[24] }}>
      <Text variant="h3">{t('onboarding.ready.lineup')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
        {items.map(({ kind, name, target }) => {
          const Icon = KIND_ICONS[kind];
          return (
            <View
              key={kind}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[8],
                paddingVertical: 6,
                paddingHorizontal: space[8],
                borderRadius: radius[8],
                backgroundColor: colors.bg.surfaceRaised,
              }}
            >
              <Icon color={colors.accent.text} size={16} strokeWidth={2} />
              <Text variant="small">{`${name} · ${target} ${label(kind, target)}`}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
