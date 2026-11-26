import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useGetSession } from '@/shared/api/generated/endpoints/sessions/sessions';
import type { UpNext } from '@/shared/api/generated/model';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Sheet } from '@/shared/ui/Sheet';
import { SkeletonCard } from '@/shared/ui/StateCards';
import { Text } from '@/shared/ui/Text';

import { exerciseName, useExerciseCatalog } from '../exercises';
import { useWorkoutText } from '../format';
import type { WorkoutEntry } from '../start';

/** The last workout's exercises, before starting it again. */
function PreviewSheet({ upNext, entry, onClose }: { upNext: UpNext; entry: WorkoutEntry; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const session = useGetSession(upNext.session_id);
  const catalog = useExerciseCatalog();
  const entries = session.data?.status === 200 ? [...(session.data.data.strength?.exercises ?? [])] : undefined;
  let body;
  if (session.isPending) {
    body = <SkeletonCard label={t('workout.upNext.loading')} rows={3} />;
  } else if (!entries) {
    body = (
      <Text variant="small" tone="muted">
        {t('workout.upNext.loadError')}
      </Text>
    );
  } else {
    body = (
      <View>
        {entries
          .sort((a, b) => a.position - b.position)
          .map((item, index) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: space[16],
                paddingVertical: space[8],
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border.default,
              }}
            >
              <Text variant="body" style={{ flex: 1 }}>
                {exerciseName(catalog.byId.get(item.exercise_id), t)}
              </Text>
              <Text variant="small" tone="muted">
                {t('workout.stats.sets', { count: item.sets.length })}
              </Text>
            </View>
          ))}
      </View>
    );
  }
  return (
    <Sheet visible title={upNext.name} onClose={onClose}>
      {body}
      <Button
        label={t('workout.start')}
        loading={entry.starting}
        onPress={async () => {
          await entry.open();
          onClose();
        }}
      />
      <Button label={t('workout.upNext.close')} variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

/**
 * "Up next" beside Home on desktop and tablets: the workout that Start repeats (the main
 * tracker's last one, spec §3.10), its size and length, and a preview of its exercises.
 */
export function UpNextCard({ upNext, entry }: { upNext: UpNext; entry: WorkoutEntry }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const text = useWorkoutText();
  const [open, setOpen] = useState(false);
  const parts = [t('workout.upNext.exercises', { count: upNext.exercise_count })];
  if (upNext.estimated_duration_s) {
    parts.push(t('workout.upNext.around', { duration: text.duration(upNext.estimated_duration_s) }));
  }
  return (
    <Card style={{ padding: space[16], gap: space[16] }}>
      <View style={{ gap: space[8] }}>
        <Text variant="caption" tone="muted" style={{ textTransform: 'uppercase' }}>
          {t('workout.upNext.title')}
        </Text>
        <Text variant="h2">{upNext.name}</Text>
        <Text variant="small" tone="muted">
          {parts.join(' · ')}
          {'\n'}
          {t('workout.upNext.prefilled')}
        </Text>
      </View>
      <Button label={t('workout.upNext.preview')} variant="secondary" onPress={() => setOpen(true)} />
      {open ? <PreviewSheet upNext={upNext} entry={entry} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}
