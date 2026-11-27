import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { CircleCheck } from './icons';
import { dialogEnter } from './motion';
import { Text } from './Text';

/** How long a toast stays. */
export const TOAST_MS = 3500;

type ToastState = { message: string | null; key: number };

const useToast = create<ToastState>()(() => ({ message: null, key: 0 }));

/** A short confirmation at the bottom of the screen ("Reading saved. Nice work."). */
export function showToast(message: string): void {
  useToast.setState(({ key }) => ({ message, key: key + 1 }));
}

/**
 * The toast from the design (System / Saved toast): a check and one line, above the tab bar on
 * phones and tablets, at the bottom of the window on desktop. It goes by itself; screen
 * readers hear it once.
 */
export function ToastHost() {
  const { message, key } = useToast();
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const expanded = useBreakpoint() === 'expanded';

  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const timer = setTimeout(() => useToast.setState({ message: null }), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, key]);

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
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
