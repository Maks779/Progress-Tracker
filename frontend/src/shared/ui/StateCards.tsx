import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { Card } from './Card';
import { CircleAlert } from './icons';
import { Text } from './Text';
import { TextLink } from './TextLink';

/** Grey placeholder rows while a list loads; screen readers hear `label` instead. */
export function SkeletonCard({ label, rows = 3 }: { label: string; rows?: number }) {
  const { colors, radius, space } = useTheme();
  const bar = (width: `${number}%`, height: number) => (
    <View style={{ width, height, borderRadius: radius[8], backgroundColor: colors.bg.surfaceRaised }} />
  );
  return (
    <Card style={{ gap: space[24], padding: space[24] }} accessibilityLabel={label} role="progressbar">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: space[16] }}>
          <View style={{ width: 24, height: 24, borderRadius: radius[8], backgroundColor: colors.bg.surfaceRaised }} />
          <View style={{ flex: 1, gap: space[8] }}>
            {bar('40%', 14)}
            {bar('65%', 12)}
          </View>
        </View>
      ))}
    </Card>
  );
}

type ErrorProps = { title?: string; message: string; retryLabel: string; onRetry: () => void };

/** A request failed: what could not load (with an alert icon when titled), and a way to try again. */
export function ErrorCard({ title, message, retryLabel, onRetry }: ErrorProps) {
  const { colors, space } = useTheme();
  return (
    <Card style={{ gap: space[4], paddingBottom: space[4] }} role="alert">
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
          <CircleAlert color={colors.state.error} size={20} strokeWidth={1.75} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {title}
          </Text>
        </View>
      ) : null}
      <Text variant="small" tone="muted">
        {message}
      </Text>
      <TextLink label={retryLabel} onPress={onRetry} align="start" />
    </Card>
  );
}
