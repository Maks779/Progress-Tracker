import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBreakpoint } from '@/shared/theme/breakpoints';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { EmberBackdrop } from '@/shared/ui/EmberBackdrop';
import { Logo } from '@/shared/ui/Logo';
import { entrance } from '@/shared/ui/motion';
import { Text } from '@/shared/ui/Text';

import { HeroPanel } from './HeroPanel';

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  caption: string;
  /** Welcome and onboarding show their tagline in capitals, as in the design; the auth screens do not. */
  upperCaption?: boolean;
  large?: boolean;
  children: ReactNode;
};

/**
 * Frame of the welcome and auth screens: the ember backdrop, a bar with the logo, then the
 * form in one column on phones and tablets, or next to the hero panel on desktop (≥ 1024 px).
 * The focused field stays above the keyboard: Android apps are edge-to-edge, so the window no
 * longer shrinks and the view adds padding instead; on iOS the scroll view moves the field.
 */
export function AuthLayout({ eyebrow, title, subtitle, caption, upperCaption = false, large = false, children }: Props) {
  const { colors, scheme, space } = useTheme();
  const wide = useBreakpoint() === 'expanded';

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg.base }]}>
      <EmberBackdrop />
      <SafeAreaView edges={['top', 'bottom']} style={styles.fill}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'android' ? 'padding' : undefined}
        >
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: wide ? space[48] : space[24],
              paddingVertical: wide ? space[32] : space[24],
            }}
          >
            <View style={styles.bar}>
              <Logo />
              <Text variant="caption" tone="muted" style={upperCaption ? { textTransform: 'uppercase' } : undefined}>
                {caption}
              </Text>
            </View>
            <View style={wide ? styles.columns : [styles.single, { paddingTop: space[40] }]}>
              {wide ? <HeroPanel /> : null}
              <View style={[wide ? styles.formWide : styles.formSingle, { gap: space[24] }]}>
                <Animated.View entering={entrance(wide ? 2 : 0)} style={{ gap: space[16] }}>
                  <Text
                    variant="captionStrong"
                    tone={scheme === 'light' ? 'primary' : 'accent'}
                    style={{ textTransform: 'uppercase', marginBottom: space[8] }}
                  >
                    {eyebrow}
                  </Text>
                  <Text variant={large ? 'display' : 'h1'} accessibilityRole="header">
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text variant="body" tone="muted">
                      {subtitle}
                    </Text>
                  ) : null}
                </Animated.View>
                <Animated.View entering={entrance(wide ? 3 : 1)} style={{ gap: space[24] }}>
                  {children}
                </Animated.View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  single: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  columns: {
    flex: 1,
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 64,
  },
  formSingle: { width: '100%' },
  formWide: { width: 400 },
});
