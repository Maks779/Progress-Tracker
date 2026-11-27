import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { openHomePage } from '@/features/navigation/openHomePage';
import { openProfilePage } from '@/features/navigation/openProfilePage';
import { TrackerRow } from '@/features/trackers/components/display';
import { useWorkoutEntry } from '@/features/workout/start';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { TrackerSummary } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Sheet } from '@/shared/ui/Sheet';
import { SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';

import { closeChooser, type ShowTab, useChooser } from '../chooser';
import { kindOf } from '../rules';

type ChoicesProps = { showTab: ShowTab; onChosen?: () => void };

/**
 * Every active tracker as a row (built from existing parts, owner's choice 2026-11-27): a
 * strength tracker starts or resumes the workout; any other opens its quick log over Home.
 * Without trackers it points to creating one.
 */
export function TrackerChoices({ showTab, onChosen }: ChoicesProps) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const pathname = usePathname();
  const switchToHome = () => showTab('(home)');
  const entry = useWorkoutEntry(switchToHome);
  const trackers = useListTrackers({ include_archived: true });
  const items = (trackers.data?.status === 200 ? trackers.data.data.items : [])
    .filter((tracker) => !tracker.archived)
    .sort((a, b) => a.position - b.position);

  const choose = async (tracker: TrackerSummary) => {
    onChosen?.();
    if (kindOf(tracker) === null) {
      await entry.open(tracker.id);
      return;
    }
    openHomePage(`/quick-log/${tracker.id}`, pathname, switchToHome);
  };

  const detail = (tracker: TrackerSummary) => {
    if (kindOf(tracker) !== null) {
      return t('quickLog.chooser.quick', { type: t(`trackers.types.${tracker.type}`) });
    }
    return t(entry.active ? 'quickLog.chooser.resume' : 'quickLog.chooser.workout');
  };

  if (trackers.isPending) {
    return <SkeletonCard label={t('quickLog.loading')} rows={3} />;
  }
  if (items.length === 0) {
    return (
      <View style={{ gap: space[16] }}>
        <Text variant="small" tone="muted">
          {t('quickLog.chooser.empty')}
        </Text>
        <Button
          label={t('quickLog.chooser.create')}
          onPress={() => {
            onChosen?.();
            openProfilePage('/profile/trackers/new', pathname, () => showTab('profile'));
          }}
        />
      </View>
    );
  }
  return (
    <View>
      {items.map((tracker) => (
        <TrackerRow
          key={tracker.id}
          icon={tracker.icon}
          color={tracker.color}
          name={tracker.name}
          detail={detail(tracker)}
          onPress={() => void choose(tracker)}
        />
      ))}
    </View>
  );
}

/** "Log a session" as a sheet, behind the "+" tab and Home's "Other". */
export function TrackerChooser() {
  const { t } = useTranslation();
  const { open, showTab } = useChooser();
  if (!open || !showTab) {
    return null;
  }
  return (
    <Sheet visible title={t('quickLog.chooser.title')} onClose={closeChooser}>
      <TrackerChoices showTab={showTab} onChosen={closeChooser} />
    </Sheet>
  );
}
