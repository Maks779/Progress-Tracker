import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';

import { Button } from './Button';
import { Card } from './Card';
import { CircleAlert } from './icons';
import { Text } from './Text';

/**
 * A list or page still loading (design: System / Loading): "Loading your progress…" and grey
 * placeholder bars; screen readers hear the label once, as a progress indicator.
 */
export function SkeletonCard({ label, rows = 3 }: { label: string; rows?: number }) {
  const { colors, radius, space } = useTheme();
  const bar = (width: `${number}%`, height: number) => (
    <View style={{ width, height, borderRadius: radius[8], backgroundColor: colors.bg.surfaceRaised }} />
  );
  return (
    <Card style={{ gap: space[16] }} accessibilityLabel={label} role="progressbar">
      <Text variant="caption" tone="muted" aria-hidden>
        {label}
      </Text>
      {bar('35%', 14)}
      {Array.from({ length: Math.max(1, rows - 2) }, (_, index) => (
        <View key={index}>{bar('100%', 48)}</View>
      ))}
      {bar('50%', 10)}
    </Card>
  );
}

type ErrorProps = { title?: string; message: string; retryLabel: string; onRetry: () => void };

/**
 * A request failed (design: System / Couldn't load): what could not load, with an alert icon
 * when titled, that saved data is safe, and a full-width Try again.
 */
export function ErrorCard({ title, message, retryLabel, onRetry }: ErrorProps) {
  const { colors, space } = useTheme();
  return (
    <Card style={{ gap: space[8] }} role="alert">
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[8] }}>
          <View style={{ flexShrink: 0, paddingTop: 1 }}>
            <CircleAlert color={colors.state.error} size={18} strokeWidth={1.75} />
          </View>
          <Text variant="smallStrong" style={{ flex: 1 }}>
            {title}
          </Text>
        </View>
      ) : null}
      <Text variant="small" tone="muted">
        {message}
      </Text>
      <View style={{ marginTop: space[8] }}>
        <Button label={retryLabel} variant="secondary" size="compact" onPress={onRetry} />
      </View>
    </Card>
  );
}
