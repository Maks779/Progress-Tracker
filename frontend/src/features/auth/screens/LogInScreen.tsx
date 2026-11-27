import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type TextInputInstance, View } from 'react-native';

import { useOutbox } from '@/features/outbox/outbox';
import { useWorkout } from '@/features/workout/store';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { LockKeyhole } from '@/shared/ui/icons';
import { Notice } from '@/shared/ui/Notice';
import { TextField } from '@/shared/ui/TextField';
import { TextLink } from '@/shared/ui/TextLink';

import { AuthLayout } from '../components/AuthLayout';
import { PasswordVisibility } from '../components/PasswordVisibility';
import { errorMessageKey } from '../errors';
import { type LogInValues, logInSchema } from '../schemas';
import { logIn } from '../session';
import { useAuthStore } from '../store';

export function LogInScreen() {
  const { t } = useTranslation();
  const { scheme, space } = useTheme();
  const expired = useAuthStore((state) => state.expired);
  const waiting = useOutbox((state) => state.items.length);
  const hasWorkout = useWorkout((state) => state.draft !== null);
  const expiredBody = [
    t('auth.logIn.expiredBody'),
    hasWorkout ? t('sync.expiredWorkout') : null,
    waiting > 0 ? t('sync.expiredWaiting', { count: waiting }) : null,
  ]
    .filter(Boolean)
    .join(' ');
  const passwordRef = useRef<TextInputInstance>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LogInValues>({
    resolver: zodResolver(logInSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const submit = useExclusive(handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await logIn(email, password);
    } catch (error) {
      setFormError(errorMessageKey(error));
    }
  }));

  return (
    <AuthLayout
      eyebrow={t('auth.logIn.eyebrow')}
      title={t('auth.logIn.title')}
      subtitle={t('auth.logIn.subtitle')}
      caption={t('auth.secure')}
    >
      {expired ? (
        <Notice tone="info" icon={LockKeyhole} title={t('auth.logIn.expiredTitle')} message={expiredBody} />
      ) : null}
      <View style={{ gap: space[16] }}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              ref={field.ref}
              label={t('auth.fields.email')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.email?.message ? t(errors.email.message) : undefined}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              ref={(input) => {
                field.ref(input);
                passwordRef.current = input;
              }}
              label={t('auth.fields.password')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message ? t(errors.password.message) : undefined}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => submit()}
              footer={
                <PasswordVisibility
                  visible={showPassword}
                  onToggle={() => setShowPassword((shown) => !shown)}
                />
              }
            />
          )}
        />
      </View>
      <TextLink
        label={t('auth.logIn.forgot')}
        href="/forgot-password"
        align="start"
        tone={scheme === 'light' ? 'primary' : 'accent'}
      />
      {formError ? <Notice tone="error" title={t(formError)} /> : null}
      <Button label={t('auth.logIn.submit')} onPress={submit} loading={isSubmitting} />
      <TextLink prefix={t('auth.logIn.noAccount')} label={t('auth.logIn.signUp')} href="/sign-up" />
    </AuthLayout>
  );
}
