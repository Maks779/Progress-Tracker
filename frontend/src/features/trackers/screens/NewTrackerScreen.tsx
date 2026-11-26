import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { BackHandler, View } from 'react-native';

import { errorMessageKey } from '@/features/auth/errors';
import { createTracker } from '@/shared/api/generated/endpoints/trackers/trackers';
import { refreshAccountData } from '@/shared/api/refresh';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Columns } from '@/shared/ui/Columns';
import { Notice } from '@/shared/ui/Notice';
import { Screen } from '@/shared/ui/Screen';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';

import { TRACKER_TYPES, type TrackerType, TYPE_DEFAULTS } from '../catalog';
import { PreviewCard, TrackerGlyph } from '../components/display';
import { TrackerFields } from '../components/fields';
import { ColorPicker, IconPicker, TypeCard } from '../components/pickers';
import { createBody, trackerSchema, type TrackerValues } from '../schemas';

type Step = 1 | 2 | 3;

const TITLES: Record<Step, string> = { 1: 'trackers.new.typeTitle', 2: 'trackers.new.nameTitle', 3: 'trackers.new.lookTitle' };

/**
 * A new tracker in three steps, as in the design: the type, then name and description (and the
 * mode for general trackers), then color and icon. A live preview shows the result all along.
 * Changing the type resets the name, color and icon to that type's defaults unless the name
 * was typed by hand. Back (the link or Android's button) returns to the previous step.
 */
export function NewTrackerScreen() {
  const { t } = useTranslation();
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const leave = () => router.dismissTo('/profile/trackers');
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<TrackerValues>({
    resolver: zodResolver(trackerSchema),
    mode: 'onTouched',
    defaultValues: {
      type: 'strength',
      name: t('trackers.names.strength'),
      description: '',
      mode: 'duration',
      unit: '',
      unitNote: '',
      ...TYPE_DEFAULTS.strength,
    },
  });
  const [type, name, mode, color, icon] = useWatch({ control, name: ['type', 'name', 'mode', 'color', 'icon'] });

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1 && !isSubmitting) {
        setStep((step - 1) as Step);
        return true;
      }
      return isSubmitting;
    });
    return () => subscription.remove();
  }, [step, isSubmitting]);

  function chooseType(next: TrackerType) {
    const current = getValues();
    const typedByHand = current.name.trim() !== '' && current.name !== t(`trackers.names.${current.type}`);
    setValue('type', next);
    setValue('color', TYPE_DEFAULTS[next].color);
    setValue('icon', TYPE_DEFAULTS[next].icon);
    if (!typedByHand) {
      setValue('name', t(`trackers.names.${next}`));
    }
  }

  async function toLook() {
    if (await trigger(['name', 'description', 'unit', 'unitNote'])) {
      setStep(3);
    }
  }

  const submit = useExclusive(
    handleSubmit(async (values) => {
      setError(null);
      try {
        const created = await createTracker(createBody(values));
        if (created.status !== 201) {
          throw new Error(`Unexpected tracker response ${created.status}`);
        }
        await refreshAccountData(queryClient);
        router.replace({ pathname: '/profile/trackers/[id]', params: { id: created.data.id } });
      } catch (failure) {
        setError(errorMessageKey(failure));
      }
    }),
  );

  const back = step === 1 ? { label: t('trackers.label'), onPress: leave } : { label: t('trackers.new.back'), onPress: () => setStep((step - 1) as Step) };

  let content;
  if (step === 1) {
    content = (
      <>
        <View role="radiogroup" aria-label={t('trackers.new.typeTitle')} style={{ gap: space[16] }}>
          {TRACKER_TYPES.map((option) => (
            <TypeCard key={option} type={option} selected={option === type} onSelect={() => chooseType(option)} />
          ))}
        </View>
        <Button label={t('trackers.new.continue')} onPress={() => setStep(2)} />
      </>
    );
  } else if (step === 2) {
    content = (
      <>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8], paddingVertical: 4, paddingHorizontal: space[8], borderRadius: radius[8], backgroundColor: colors.bg.surfaceRaised }}>
            <TrackerGlyph icon={icon} color={color} size={16} />
            <Text variant="captionStrong">{t('trackers.new.typeChip', { type: t(`trackers.types.${type}`) })}</Text>
          </View>
        </View>
        <TrackerFields control={control} errors={errors} type={type} mode={mode} modeLocked={false} />
        <Text variant="small" tone="muted">
          {t('trackers.fields.sessionsNote')}
        </Text>
        <Button label={t('trackers.new.toLook')} onPress={toLook} />
      </>
    );
  } else {
    content = (
      <>
        <TextField label={t('trackers.fields.name')} value={name} editable={false} />
        <Controller
          control={control}
          name="color"
          render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
        />
        <Controller
          control={control}
          name="icon"
          render={({ field }) => <IconPicker value={field.value} color={color} onChange={field.onChange} />}
        />
        {error ? <Notice tone="error" title={t(error)} /> : null}
        <Button label={t('trackers.new.submit')} onPress={submit} loading={isSubmitting} />
      </>
    );
  }

  return (
    <Screen key={step} title={t(TITLES[step])} caption={t('trackers.new.step', { step })} back={back}>
      <Columns
        main={<Card style={{ gap: space[24], padding: space[24] }}>{content}</Card>}
        side={<PreviewCard type={type} name={name} icon={icon} color={color} />}
      />
    </Screen>
  );
}
