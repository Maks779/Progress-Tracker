import { useTranslation } from 'react-i18next';

import { Button, type ButtonVariant } from '@/shared/ui/Button';

import type { WorkoutEntry } from '../start';

/** "Start workout", or "Resume workout" while one is under way on this device (design review #26). */
export function WorkoutButton({ entry, variant = 'primary' }: { entry: WorkoutEntry; variant?: ButtonVariant }) {
  const { t } = useTranslation();
  if (!entry.available) {
    return null;
  }
  return (
    <Button
      label={t(entry.active ? 'workout.resume' : 'workout.start')}
      variant={variant}
      loading={entry.starting}
      onPress={() => entry.open()}
    />
  );
}
