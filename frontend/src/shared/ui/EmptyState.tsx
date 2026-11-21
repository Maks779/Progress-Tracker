import { useTheme } from '@/shared/theme/ThemeProvider';

import { Card } from './Card';
import { Sparkles } from './icons';
import { Text } from './Text';

export function EmptyState({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <Card>
      <Sparkles color={colors.accent.text} size={24} strokeWidth={1.75} />
      <Text tone="muted">{message}</Text>
    </Card>
  );
}
