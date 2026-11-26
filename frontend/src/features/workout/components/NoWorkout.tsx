import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Sparkles } from '@/shared/ui/icons';
import { Screen } from '@/shared/ui/Screen';
import { Text } from '@/shared/ui/Text';

/** Shown when the workout ended elsewhere (another tab, a stale page): the way back to Home. */
export function NoWorkout() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  return (
    <Screen title={t('workout.none.title')}>
      <Card style={{ padding: space[24], gap: space[16] }}>
        <Sparkles color={colors.accent.text} size={24} strokeWidth={1.75} />
        <Text variant="small" tone="muted">
          {t('workout.none.body')}
        </Text>
        <Button label={t('workout.none.action')} variant="secondary" onPress={() => router.dismissTo('/')} />
      </Card>
    </Screen>
  );
}
