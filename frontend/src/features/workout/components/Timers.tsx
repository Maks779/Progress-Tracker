import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, View, type ViewStyle } from 'react-native';

import { useNow } from '@/shared/hooks/useNow';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { showFocusRing } from '@/shared/ui/focusRing';
import { Timer } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import { useWorkoutText } from '../format';
import { durationSeconds, type Rest, restLeft } from '../rules';
import { workout } from '../store';

/** "18:42 elapsed", ticking every second; only this text re-renders, not the workout. */
export function Elapsed({ startedAt, prefix }: { startedAt: string; prefix?: string }) {
  const { t } = useTranslation();
  const text = useWorkoutText();
  const now = useNow();
  const time = t('workout.elapsed', { time: text.clock(durationSeconds(startedAt, now)) });
  return <>{prefix ? `${prefix} · ${time}` : time}</>;
}

function TimerAction({ label, name, tone, onPress }: { label: string; name: string; tone: 'primary' | 'accent'; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={name}
      onPress={onPress}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        minWidth: 44,
        minHeight: 44,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius[8],
        opacity: hovered ? 0.75 : 1,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <Text variant="smallStrong" tone={tone}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The rest timer from the design: time left, "Rest · of 90 seconds", "+30s" and "Skip". Its
 * end time is in the draft, so it keeps counting through a restart; at zero it goes away and
 * screen readers hear that rest is over.
 */
export function RestTimer({ rest, floating = false }: { rest: Rest; floating?: boolean }) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const text = useWorkoutText();
  const now = useNow(250);
  const left = restLeft(rest, now);
  const counting = useRef(false);

  useEffect(() => {
    if (left > 0) {
      counting.current = true;
      return;
    }
    if (counting.current) {
      AccessibilityInfo.announceForAccessibility(t('workout.rest.over'));
    }
    counting.current = false;
    workout.skipRest();
  }, [left, t]);

  if (left === 0) {
    return null;
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[16],
        paddingLeft: space[16],
        paddingRight: space[8],
        paddingVertical: space[8],
        minHeight: 56,
        borderRadius: radius[16],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: floating ? colors.bg.surfaceRaised : colors.bg.surface,
        ...(floating ? { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)' } : null),
      }}
    >
      <Timer color={colors.accent.text} size={24} strokeWidth={1.75} />
      <View
        style={{ flex: 1 }}
        accessible
        accessibilityLabel={t('workout.rest.label', { time: text.restClock(left), total: rest.seconds })}
      >
        <Text variant="h3" style={{ fontVariant: ['tabular-nums'] }}>
          {text.restClock(left)}
        </Text>
        <Text variant="caption" tone="muted">
          {t('workout.rest.caption', { count: rest.seconds })}
        </Text>
      </View>
      <TimerAction label={t('workout.rest.more')} name={t('workout.rest.moreName')} tone="primary" onPress={() => workout.extendRest()} />
      <TimerAction label={t('workout.rest.skip')} name={t('workout.rest.skipName')} tone="accent" onPress={() => workout.skipRest()} />
    </View>
  );
}
