import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { deliverExercise, itemKey, removeItem } from '@/features/outbox/outbox';
import { getListExercisesQueryKey } from '@/shared/api/generated/endpoints/exercises/exercises';
import type { ExerciseOut } from '@/shared/api/generated/model';
import { newId } from '@/shared/ids';
import { Button } from '@/shared/ui/Button';
import { ChipGroup } from '@/shared/ui/Chips';
import { Notice } from '@/shared/ui/Notice';
import { Sheet } from '@/shared/ui/Sheet';
import { TextField } from '@/shared/ui/TextField';

import { EQUIPMENT, type Equipment, MUSCLE_GROUPS, type MuscleGroup, waitingExercise } from '../exercises';

type Props = {
  userId: string;
  name: string;
  muscle: MuscleGroup;
  onCreated: (exercise: ExerciseOut) => void;
  onClose: () => void;
};

/**
 * "Create an exercise" for what the catalog lacks: a name, the muscle group and the equipment
 * (bodyweight ones may be logged without a weight). It is saved under an ID from the device,
 * through the outbox: offline it is usable at once and reaches the server before the workout.
 */
export function CustomExerciseSheet({ userId, name: initialName, muscle: initialMuscle, onCreated, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<MuscleGroup>(initialMuscle);
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('workout.custom.nameRequired'));
      return;
    }
    setError(null);
    const id = newId();
    const body = { name: trimmed, muscle_group: muscle, equipment };
    const result = await deliverExercise(id, userId, body);
    if (result.status === 'refused') {
      await removeItem(itemKey({ kind: 'exercise', id }));
      setError(t('workout.custom.failed'));
      return;
    }
    if (result.status === 'saved') {
      await queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
    }
    onCreated(result.status === 'saved' ? result.data : waitingExercise(id, body));
  };

  return (
    <Sheet visible title={t('workout.custom.title')} onClose={onClose}>
      <TextField
        label={t('workout.custom.name')}
        value={name}
        onChangeText={(next) => {
          setName(next);
          setNameError(undefined);
        }}
        maxLength={60}
        error={nameError}
        autoFocus={!initialName}
      />
      <ChipGroup
        label={t('workout.custom.muscle')}
        value={muscle}
        onChange={setMuscle}
        options={MUSCLE_GROUPS.map((value) => ({ value, label: t(`exercises.muscle.${value}`) }))}
      />
      <ChipGroup
        label={t('workout.custom.equipment')}
        value={equipment}
        onChange={setEquipment}
        options={EQUIPMENT.map((value) => ({ value, label: t(`exercises.equipment.${value}`) }))}
      />
      {error ? <Notice tone="error" title={error} /> : null}
      <Button label={t('workout.custom.save')} onPress={save} />
      <Button label={t('workout.custom.cancel')} variant="secondary" onPress={onClose} />
    </Sheet>
  );
}
