import { HeaderShownContext } from 'expo-router/react-navigation';
import { type ReactNode, useContext } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { showFocusRing } from './focusRing';
import { ChevronLeft } from './icons';
import { Text } from './Text';

/** `step` marks a step back inside the page (a form in steps), which desktop keeps. */
type Back = { label: string; onPress: () => void; step?: boolean };

/** `caption` may be live text, such as the workout's elapsed time. */
type Props = { title: string; caption?: ReactNode; back?: Back; action?: ReactNode; children?: ReactNode };

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
 * A page: safe-area padding (unless the top bar above already covers it), an optional link
 * back to the parent page, the screen title (with an optional caption under it and an
 * optional action beside it) and scrollable content, centred on wide screens. Tablets and
 * desktop get the roomier padding of their designs. On desktop the breadcrumb in the top bar
 * leads to the parent pages, so only a step back stays.
 */
export function Screen({ title, caption, back, action, children }: Props) {
  const { colors, space } = useTheme();
  const breakpoint = useBreakpoint();
  const underTopBar = useContext(HeaderShownContext);
  const padding =
    breakpoint === 'compact'
      ? { padding: space[24] }
      : { paddingHorizontal: space[40], paddingTop: space[32], paddingBottom: space[40] };
  const showBack = back && (breakpoint !== 'expanded' || back.step);
  return (
    <SafeAreaView edges={underTopBar ? [] : ['top']} style={[styles.root, { backgroundColor: colors.bg.base }]}>
      <ScrollView
        contentContainerStyle={[styles.content, padding, { gap: space[24] }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.column}>
          {showBack ? <BackLink label={back.label} onPress={back.onPress} /> : null}
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
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  titleText: { flex: 1 },
});
