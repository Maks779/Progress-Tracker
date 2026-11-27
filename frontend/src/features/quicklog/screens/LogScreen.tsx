import { useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Card } from '@/shared/ui/Card';
import { Screen } from '@/shared/ui/Screen';

import { TrackerChoices } from '../components/TrackerChooser';

/**
 * The "+" tab as a page, for a link to /log on the web: the same list as the "Log a session"
 * sheet that the tab itself opens.
 */
export function LogScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  return (
    <Screen title={t('quickLog.chooser.title')}>
      <Card style={{ padding: 16 }}>
        <TrackerChoices showTab={(tab) => navigation.navigate(tab)} />
      </Card>
    </Screen>
  );
}
