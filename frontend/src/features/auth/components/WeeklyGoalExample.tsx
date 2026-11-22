import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';

import { fadeIn } from '@/shared/ui/motion';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import { Text } from '@/shared/ui/Text';

const DELAY_MS = 350;
const FILL_MS = 1200;

/** The app's core idea in one picture: a weekly goal, 2 of 3 workouts done, as on Home. */
export function WeeklyGoalExample({ size }: { size: number }) {
  const { t } = useTranslation();
  const value = t('auth.hero.ringValue');
  const caption = t('auth.hero.ringCaption');
  return (
    <ProgressRing
      size={size}
      progress={2 / 3}
      duration={FILL_MS}
      delay={DELAY_MS}
      glow
      accessibilityLabel={`${value} ${caption}`}
    >
      <Animated.View
        entering={fadeIn(DELAY_MS + 400)}
        style={{ alignItems: 'center', maxWidth: size * 0.7 }}
      >
        <Text variant="display">{value}</Text>
        <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          {caption}
        </Text>
      </Animated.View>
    </ProgressRing>
  );
}
