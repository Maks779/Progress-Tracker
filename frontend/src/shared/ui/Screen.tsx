import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';
import { ChevronLeft } from './icons';
import { Text } from './Text';

type Back = { label: string; onPress: () => void };

type Props = { title: string; caption?: string; back?: Back; action?: ReactNode; children?: ReactNode };

function BackLink({ label, onPress }: Back) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      role="link"
      aria-label={label}
      onPress={onPress}
      hitSlop={8}
      style={({ hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        minHeight: 44,
        marginLeft: -6,
        paddingRight: 8,
        borderRadius: radius[8],
        opacity: hovered ? 0.75 : 1,
        cursor: 'pointer',
        outlineStyle: 'solid',
        outlineWidth: showFocusRing(focused) ? 2 : 0,
        outlineColor: colors.accent.fill,
      })}
    >
      <ChevronLeft color={colors.accent.text} size={20} strokeWidth={2} />
      <Text variant="smallStrong" tone="accent">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A page: safe-area padding, an optional link back to the parent page, the screen title (with
 * an optional caption under it and an optional action beside it) and scrollable content,
 * centred on wide screens.
 */
export function Screen({ title, caption, back, action, children }: Props) {
  const { colors, space } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.bg.base }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { padding: space[24], gap: space[24] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          {back ? <BackLink {...back} /> : null}
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text variant="h1" accessibilityRole="header">
                {title}
              </Text>
              {caption ? (
                <Text variant="caption" tone="muted" style={{ textTransform: 'uppercase', marginTop: 4 }}>
                  {caption}
                </Text>
              ) : null}
            </View>
            {action}
          </View>
        </View>
        <View style={[styles.column, { gap: space[16] }]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { alignItems: 'center' },
  column: { width: '100%', maxWidth: 1100 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  titleText: { flex: 1 },
});
