import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { openHomePage } from '@/features/navigation/openHomePage';
import type { TrackerSummary } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';

import { openChooser, type ShowTab } from '../chooser';
import { kindOf } from '../rules';

type Props = { trackers: TrackerSummary[]; showTab: ShowTab };

/**
 * Home's quick actions under the ring (design: Home / Today): "Log reading" opens the reading
 * tracker's quick log, "Other" the sheet of every tracker. Without a reading tracker one button,
 * "Log a session", opens the sheet; with only strength trackers there is nothing to log here.
 */
export function QuickActions({ trackers, showTab }: Props) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const pathname = usePathname();
  const active = trackers.filter((tracker) => !tracker.archived).sort((a, b) => a.position - b.position);
  if (!active.some((tracker) => kindOf(tracker) !== null)) {
    return null;
  }
  const reading = active.find((tracker) => tracker.type === 'reading');
  const choose = () => openChooser(showTab);
  return (
    <View style={{ flexDirection: 'row', gap: space[16] }}>
      {reading ? (
        <View style={{ flex: 1 }}>
          <Button
            label={t('quickLog.actions.reading')}
            variant="secondary"
            onPress={() => openHomePage(`/quick-log/${reading.id}`, pathname, () => showTab('(home)'))}
          />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Button label={t(reading ? 'quickLog.actions.other' : 'quickLog.actions.any')} variant="secondary" onPress={choose} />
      </View>
    </View>
  );
}
