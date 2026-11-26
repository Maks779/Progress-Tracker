import { type Control, Controller, type FieldErrors } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '@/shared/theme/ThemeProvider';
import { Segmented } from '@/shared/ui/Segmented';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';

import type { GeneralMode, TrackerType } from '../catalog';
import type { TrackerValues } from '../schemas';

type Props = {
  control: Control<TrackerValues>;
  errors: FieldErrors<TrackerValues>;
  type: TrackerType;
  mode: GeneralMode;
  modeLocked: boolean;
};

/**
 * Name and description of a tracker; a general tracker also has its mode (time or a number,
 * chosen once) and, when it counts, the unit and an optional note about it.
 */
export function TrackerFields({ control, errors, type, mode, modeLocked }: Props) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const error = (key: keyof TrackerValues) => {
    const message = errors[key]?.message;
    return message ? t(message) : undefined;
  };
  return (
    <View style={{ gap: space[16] }}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            ref={field.ref}
            label={t('trackers.fields.name')}
            hint={t('trackers.fields.nameHint')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={error('name')}
            maxLength={60}
            autoCapitalize="sentences"
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextField
            ref={field.ref}
            label={t('trackers.fields.description')}
            placeholder={t(`trackers.fields.descriptionPlaceholder.${type}`)}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={error('description')}
            maxLength={220}
            autoCapitalize="sentences"
          />
        )}
      />
      {type === 'general' ? (
        <View style={{ gap: space[8] }}>
          <Text variant="smallStrong">{t('trackers.fields.mode')}</Text>
          {modeLocked ? (
            <Text tone="muted">{t(`trackers.fields.modes.${mode}`)}</Text>
          ) : (
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <Segmented
                  label={t('trackers.fields.mode')}
                  value={field.value}
                  onChange={field.onChange}
                  options={(['duration', 'counter'] as const).map((value) => ({
                    value,
                    label: t(`trackers.fields.modes.${value}`),
                  }))}
                />
              )}
            />
          )}
          <Text variant="caption" tone="muted">
            {t(modeLocked ? 'trackers.fields.modeFixed' : 'trackers.fields.modeHint')}
          </Text>
        </View>
      ) : null}
      {type === 'general' && mode === 'counter' ? (
        <>
          <Controller
            control={control}
            name="unit"
            render={({ field }) => (
              <TextField
                ref={field.ref}
                label={t('trackers.fields.unit')}
                hint={t('trackers.fields.unitHint')}
                placeholder={t('trackers.fields.unitPlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={error('unit')}
                maxLength={30}
                autoCapitalize="none"
              />
            )}
          />
          <Controller
            control={control}
            name="unitNote"
            render={({ field }) => (
              <TextField
                ref={field.ref}
                label={t('trackers.fields.unitNote')}
                placeholder={t('trackers.fields.unitNotePlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={error('unitNote')}
                maxLength={50}
                autoCapitalize="none"
              />
            )}
          />
        </>
      ) : null}
    </View>
  );
}
