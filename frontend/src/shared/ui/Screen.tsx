import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { Text } from './Text';

type Props = { title: string; children?: ReactNode };

/** A page: safe-area padding, the screen title and scrollable content, centred on wide screens. */
export function Screen({ title, children }: Props) {
  const { colors, space } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.bg.base }]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: space[24], gap: space[24] }]}>
        <View style={styles.column}>
          <Text variant="h1" accessibilityRole="header">
            {title}
          </Text>
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
});
