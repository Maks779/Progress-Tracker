import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { backdropEnter, dialogEnter, sheetEnter } from './motion';
import { Text } from './Text';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * A confirmation over the screen (delete account, discard workout): a sheet from the bottom
 * edge with a 24 px top radius on phones, a centred dialog on desktop. Tapping outside, the
 * Android back button, the VoiceOver escape gesture and Escape on the web close it; the
 * keyboard never covers its fields, and content taller than the screen scrolls. The dimmed backdrop is hidden from screen readers and
 * Tab, so the sheet's own buttons are the only way out for them.
 */
export function Sheet({ visible, title, onClose, children }: Props) {
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() === 'expanded';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Animated.View entering={backdropEnter()} style={[StyleSheet.absoluteFill, styles.backdrop]}>
          <Pressable accessible={false} focusable={false} aria-hidden onPress={onClose} style={styles.fill} />
        </Animated.View>
        <View pointerEvents="box-none" style={[styles.fill, wide ? styles.centre : styles.bottom]}>
          <Animated.View
            entering={wide ? dialogEnter() : sheetEnter()}
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
            role="dialog"
            aria-modal
            aria-label={title}
            style={{
              width: '100%',
              maxWidth: wide ? 480 : undefined,
              maxHeight: '92%',
              backgroundColor: colors.bg.surface,
              borderColor: colors.border.default,
              borderWidth: 1,
              borderRadius: wide ? radius[24] : undefined,
              borderTopLeftRadius: radius[24],
              borderTopRightRadius: radius[24],
              padding: space[24],
              paddingBottom: wide ? space[24] : space[24] + insets.bottom,
              gap: space[16],
            }}
          >
            {wide ? null : (
              <View
                style={{
                  alignSelf: 'center',
                  width: 40,
                  height: 4,
                  borderRadius: radius.full,
                  backgroundColor: colors.border.default,
                }}
              />
            )}
            <Text variant="h2" accessibilityRole="header">
              {title}
            </Text>
            <ScrollView
              style={styles.content}
              contentContainerStyle={{ gap: space[16] }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  bottom: { justifyContent: 'flex-end' },
  content: { flexGrow: 0 },
  centre: { justifyContent: 'center', alignItems: 'center', padding: 24 },
});
