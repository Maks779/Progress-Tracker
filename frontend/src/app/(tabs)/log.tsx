import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/shared/ui/EmptyState';
import { Screen } from '@/shared/ui/Screen';

export default function LogScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('log.title')}>
      <EmptyState message={t('log.empty')} />
    </Screen>
  );
}
