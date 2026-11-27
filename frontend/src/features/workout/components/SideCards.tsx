import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { Card } from '@/shared/ui/Card';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Text } from '@/shared/ui/Text';

import { useWorkoutText } from '../format';
import type { Tally } from '../rules';

/** "Session so far" on desktop: the volume and the checked sets, with a bar of sets done. */
export function SessionSoFar({ counts }: { counts: Tally }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const text = useWorkoutText();
  const total = counts.done + counts.open;
  const stats = [
    { label: t('workout.stats.volume', { unit: text.unitLabel }), value: text.weightValue(counts.volumeKg) },
    { label: t('workout.stats.done'), value: t('workout.stats.sets', { count: counts.done }) },
  ];
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      <Text variant="h3" accessibilityRole="header">
        {t('workout.soFar')}
      </Text>
      <View style={{ flexDirection: 'row', gap: space[16] }}>
        {stats.map((stat) => (
          <View key={stat.label} style={{ flex: 1, gap: 4 }} accessible accessibilityLabel={`${stat.label}: ${stat.value}`}>
            <Text variant="caption" tone="muted">
              {stat.label}
            </Text>
            <Text variant="h1" style={{ fontVariant: ['tabular-nums'] }}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>
      <ProgressBar value={total > 0 ? counts.done / total : 0} color={colors.accent.fill} label={t('workout.soFarBar', { done: counts.done, total })} />
    </Card>
  );
}

/** What the ghost values mean, beside the workout on desktop. */
export function GhostTip() {
  const { t } = useTranslation();
  const { space } = useTheme();
  return (
    <Card style={{ padding: space[16], gap: space[8] }}>
      <Text variant="smallStrong">{t('workout.tip.title')}</Text>
      <Text variant="small" tone="muted">
        {t('workout.tip.body')}
      </Text>
      <Text variant="caption" tone="muted" style={{ marginTop: space[8] }}>
        {t('workout.tip.rest')}
      </Text>
    </Card>
  );
}
