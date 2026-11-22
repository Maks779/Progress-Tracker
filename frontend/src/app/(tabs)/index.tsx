import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useHealth } from '@/shared/api/generated/endpoints/system/system';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Card } from '@/shared/ui/Card';
import { Screen } from '@/shared/ui/Screen';
import { Text } from '@/shared/ui/Text';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const health = useHealth({ query: { refetchInterval: 15_000 } });

  const online = health.data?.data.status === 'ok';
  const status = health.isPending
    ? t('home.apiChecking')
    : online
      ? t('home.apiOnline')
      : t('home.apiOffline');

  return (
    <Screen title={t('home.title')}>
      <Card>
        <Text variant="captionStrong" tone="muted">
          {t('home.api')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: health.isPending
                ? colors.text.muted
                : online
                  ? colors.state.success
                  : colors.state.error,
            }}
          />
          <Text variant="bodyStrong">{status}</Text>
        </View>
      </Card>
    </Screen>
  );
}
