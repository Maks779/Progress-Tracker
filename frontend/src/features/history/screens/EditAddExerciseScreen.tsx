import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ExercisePicker } from '@/features/workout/screens/AddExerciseScreen';

import { sessionEdit, useSessionEdit } from '../editing';

/**
 * Add exercise while a workout is edited in History: the workout's picker, adding to the
 * session being edited (what was forgotten), then back to the edit page. Without an edit
 * under way (a reload) it goes back to the edit page, which starts one.
 */
export function EditAddExerciseScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const draft = useSessionEdit((state) => state.draft);
  if (!draft || draft.id !== id) {
    return <Redirect href={`/history/${id}/edit`} />;
  }
  const back = () => router.dismissTo(`/history/${id}/edit`);
  return (
    <ExercisePicker
      draft={draft}
      caption={t('history.edit.pickerCaption')}
      back={{ label: t('history.edit.title'), onPress: back }}
      side={{ title: t('history.edit.pickerSideTitle'), body: t('history.edit.pickerSideBody') }}
      onAdd={(items) => {
        sessionEdit.addExercises(items);
        back();
      }}
    />
  );
}
