import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Me } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Card } from '@/shared/ui/Card';
import { Text } from '@/shared/ui/Text';
import { TextLink } from '@/shared/ui/TextLink';

/** "Alex Morgan" -> "AM"; works for any alphabet and for one-word names. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? '')
    .join('');
}

type Props = { me: Me | undefined; loading: boolean; onRetry: () => void };

/** The account at the top of Profile: initials, name and email, with loading and error states. */
export function ProfileCard({ me, loading, onRetry }: Props) {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const circle = {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.accent.subtle,
  };

  if (me) {
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[16] }}>
        <View style={circle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text variant="bodyStrong">{initials(me.name)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {me.name}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {me.email}
          </Text>
        </View>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[16] }}
        accessibilityLabel={t('profile.loading')}
      >
        <View style={circle} />
        <View style={{ flex: 1, gap: space[8] }}>
          <View style={{ width: '45%', height: 14, borderRadius: radius[8], backgroundColor: colors.bg.surfaceRaised }} />
          <View style={{ width: '65%', height: 12, borderRadius: radius[8], backgroundColor: colors.bg.surfaceRaised }} />
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ gap: 0, paddingBottom: space[4] }}>
      <Text variant="small" tone="muted">
        {t('profile.loadError')}
      </Text>
      <TextLink label={t('profile.retry')} onPress={onRetry} align="start" />
    </Card>
  );
}
