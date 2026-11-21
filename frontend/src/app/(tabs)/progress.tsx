import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/shared/ui/EmptyState';
import { Screen } from '@/shared/ui/Screen';

export default function ProgressScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('progress.title')}>
      <EmptyState message={t('progress.empty')} />
    </Screen>
  );
}
