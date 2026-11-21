import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/shared/ui/EmptyState';
import { Screen } from '@/shared/ui/Screen';

export default function HistoryScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('history.title')}>
      <EmptyState message={t('history.empty')} />
    </Screen>
  );
}
