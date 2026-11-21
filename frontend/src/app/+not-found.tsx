import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Screen } from '@/shared/ui/Screen';
import { Text } from '@/shared/ui/Text';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <Screen title="404">
      <Card>
        <Text variant="h3">{t('notFound.title')}</Text>
        <Text tone="muted">{t('notFound.body')}</Text>
        <Button label={t('notFound.back')} variant="secondary" onPress={() => router.replace('/')} />
      </Card>
    </Screen>
  );
}
