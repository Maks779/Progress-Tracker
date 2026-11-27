import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';
import { CircleCheck } from './icons';
import { dialogEnter } from './motion';
import { Text } from './Text';

/** How long a toast stays. */
export const TOAST_MS = 3500;

/** How long a toast with an action stays, so there is time to take it back (spec §3.2: Undo for 6 seconds). */
export const SNACKBAR_MS = 6000;

export type ToastAction = { label: string; onPress: () => void };

type ToastState = { message: string | null; action: ToastAction | null; key: number };

const useToast = create<ToastState>()(() => ({ message: null, action: null, key: 0 }));

/**
 * A short confirmation at the bottom of the screen ("Reading saved. Nice work."); with an
 * action it is the design's snackbar ("Session removed · Undo").
 */
export function showToast(message: string, action?: ToastAction): void {
  useToast.setState(({ key }) => ({ message, action: action ?? null, key: key + 1 }));
}

/**
 * The toast from the design (System / Saved toast, Undo snackbar): a check, one line and an
 * optional action, above the tab bar on phones and tablets, at the bottom of the window on
 * desktop. It goes by itself; screen readers hear it once.
 */
export function ToastHost() {
  const { message, action, key } = useToast();
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const expanded = useBreakpoint() === 'expanded';

  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const timer = setTimeout(() => useToast.setState({ message: null, action: null }), action ? SNACKBAR_MS : TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, action, key]);

  return (
    <View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      role="status"
      style={[styles.host, { bottom: (expanded ? space[32] : 96) + insets.bottom }]}
    >
      {message ? (
        <Animated.View
          key={key}
          entering={dialogEnter()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[16],
            maxWidth: 480,
            marginHorizontal: space[24],
            paddingVertical: space[16],
            paddingHorizontal: space[16],
            borderRadius: radius[12],
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.bg.surface,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          }}
        >
          <CircleCheck color={colors.state.success} size={20} strokeWidth={1.75} />
          <Text variant="small" style={{ flexShrink: 1 }}>
            {message}
          </Text>
          {action ? (
            <Pressable
              role="button"
              aria-label={action.label}
              hitSlop={8}
              onPress={() => {
                useToast.setState({ message: null, action: null });
                action.onPress();
              }}
              style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
                marginLeft: space[8],
                paddingHorizontal: space[8],
                minHeight: 32,
                justifyContent: 'center',
                borderRadius: radius[8],
                opacity: hovered ? 0.8 : 1,
                cursor: 'pointer',
                outlineStyle: 'solid',
                outlineWidth: showFocusRing(focused) ? 2 : 0,
                outlineColor: colors.accent.fill,
              })}
            >
              <Text variant="smallStrong" tone="accent">
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
