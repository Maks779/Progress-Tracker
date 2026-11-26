import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, View } from 'react-native';

import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { errorMessageKey } from '@/features/auth/errors';
import { getReadMeQueryKey } from '@/shared/api/generated/endpoints/me/me';
import { getListTrackersQueryKey } from '@/shared/api/generated/endpoints/trackers/trackers';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Check } from '@/shared/ui/icons';
import { Notice } from '@/shared/ui/Notice';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import { Text } from '@/shared/ui/Text';
import { TextLink } from '@/shared/ui/TextLink';

import { ChoiceCard, GoalCard, Lineup, StreakNote } from './components';
import { initialTargets, KINDS, stepTarget, type TrackerKind } from './plan';
import { type Choice, createLineup, type Progress } from './setup';
import { useOnboarding } from './store';

type Step = 1 | 2 | 3;

/**
 * The three steps after sign-up: what to track, a weekly goal for each, and a summary. The
 * trackers and goals are created when step 2 is confirmed; Home opens after "Let's begin".
 * Android's back button goes from step 2 to step 1; nothing goes back once the trackers exist.
 */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const queryClient = useQueryClient();
  const setStatus = useOnboarding((state) => state.setStatus);
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<TrackerKind[]>(['strength']);
  const [targets, setTargets] = useState(initialTargets);
  const [showNone, setShowNone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [started, setStarted] = useState(false);
  const progress = useRef<Progress>({});

  const chosen = KINDS.filter((kind) => selected.includes(kind));
  const choices: Choice[] = chosen.map((kind) => ({
    kind,
    name: t(`onboarding.names.${kind}`),
    target: targets[kind],
  }));

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 2 && !started && !saving) {
        setStep(1);
        return true;
      }
      return step === 3;
    });
    return () => subscription.remove();
  }, [step, started, saving]);

  function toggle(kind: TrackerKind) {
    setShowNone(false);
    setSelected((current) =>
      current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind],
    );
  }

  function goToGoals() {
    if (selected.length === 0) {
      setShowNone(true);
      return;
    }
    setStep(2);
  }

  const save = useExclusive(async () => {
    setError(null);
    setSaving(true);
    try {
      await createLineup(choices, progress.current);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListTrackersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getReadMeQueryKey() }),
      ]);
      setStep(3);
    } catch (failure) {
      setError(errorMessageKey(failure));
    } finally {
      setStarted(Object.keys(progress.current).length > 0);
      setSaving(false);
    }
  });

  const eyebrow = t('onboarding.step', { current: `0${step}`, total: '03' });
  const footer = (
    <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
      {t('onboarding.footer')}
    </Text>
  );

  if (step === 1) {
    return (
      <AuthLayout
        key="choose"
        eyebrow={eyebrow}
        title={t('onboarding.choose.title')}
        subtitle={t('onboarding.choose.subtitle')}
        caption={t('auth.welcome.caption')}
      >
        <View role="group" aria-label={t('onboarding.choose.title')} style={{ gap: space[8] }}>
          {KINDS.map((kind) => (
            <ChoiceCard key={kind} kind={kind} checked={selected.includes(kind)} onToggle={() => toggle(kind)} />
          ))}
        </View>
        {showNone ? <Notice tone="error" title={t('onboarding.choose.none')} /> : null}
        <Button label={t('onboarding.choose.continue')} onPress={goToGoals} />
        {footer}
      </AuthLayout>
    );
  }

  if (step === 2) {
    return (
      <AuthLayout
        key="goals"
        eyebrow={eyebrow}
        title={t('onboarding.goal.title')}
        subtitle={t('onboarding.goal.subtitle')}
        caption={t('auth.welcome.caption')}
      >
        {choices.map(({ kind, name, target }) => (
          <GoalCard
            key={kind}
            kind={kind}
            name={name}
            value={target}
            onChange={(direction) =>
              setTargets((current) => ({ ...current, [kind]: stepTarget(kind, current[kind], direction) }))
            }
          />
        ))}
        <StreakNote />
        {error ? <Notice tone="error" title={t(error)} /> : null}
        <Button label={t('onboarding.goal.submit', { count: choices.length })} onPress={save} loading={saving} />
        {started || saving ? null : <TextLink label={t('onboarding.goal.back')} onPress={() => setStep(1)} />}
        {footer}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      key="ready"
      eyebrow={eyebrow}
      title={t('onboarding.ready.title')}
      subtitle={t('onboarding.ready.subtitle')}
      caption={t('auth.welcome.caption')}
    >
      <View style={{ alignItems: 'center', paddingVertical: space[8] }}>
        <ProgressRing size={160} progress={1} duration={1100} delay={200} glow accessibilityLabel={t('onboarding.ready.ring')}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Check color={colors.text.primary} size={36} strokeWidth={2.5} />
            <Text variant="caption" tone="muted">
              {t('onboarding.ready.ring')}
            </Text>
          </View>
        </ProgressRing>
      </View>
      <Lineup items={choices} />
      <Button label={t('onboarding.ready.begin')} onPress={() => setStatus('done')} />
      {footer}
    </AuthLayout>
  );
}
