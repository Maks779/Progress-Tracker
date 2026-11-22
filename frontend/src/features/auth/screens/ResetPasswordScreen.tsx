import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, type TextInputInstance, View } from 'react-native';

import { ApiError } from '@/shared/api/fetcher';
import { checkResetToken, resetPassword } from '@/shared/api/generated/endpoints/auth/auth';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Notice';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';
import { TextLink } from '@/shared/ui/TextLink';

import { AuthLayout } from '../components/AuthLayout';
import { PasswordVisibility } from '../components/PasswordVisibility';
import { errorMessageKey, isCommonPasswordError } from '../errors';
import { type ResetPasswordValues, resetPasswordSchema } from '../schemas';
import { forgetSession } from '../session';

type Stage = 'checking' | 'form' | 'done' | 'invalid';

function isInvalidLink(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 400 || error.status === 422);
}

/**
 * Opened from the emailed link `/reset-password?token=…`. The link is checked first, so a used
 * or expired one is reported before the user types a new password. When the check cannot reach
 * the server, the form still opens and saving reports the problem.
 */
export function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const confirmRef = useRef<TextInputInstance>(null);
  const [stage, setStage] = useState<Stage>(token ? 'checking' : 'invalid');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    trigger,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = useWatch({ control, name: 'password' });

  useEffect(() => {
    if (!token) {
      return undefined;
    }
    const request = new AbortController();
    checkResetToken({ token }, { signal: request.signal })
      .then(() => setStage('form'))
      .catch((error: unknown) => {
        if (!request.signal.aborted) {
          setStage(isInvalidLink(error) ? 'invalid' : 'form');
        }
      });
    return () => request.abort();
  }, [token]);

  const submit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await resetPassword({ token: token ?? '', new_password: password });
      await forgetSession();
      setStage('done');
    } catch (error) {
      if (isCommonPasswordError(error)) {
        setError('password', { message: 'auth.errors.passwordTooCommon' }, { shouldFocus: true });
      } else if (isInvalidLink(error)) {
        setStage('invalid');
      } else {
        setFormError(errorMessageKey(error));
      }
    }
  });

  return (
    <AuthLayout
      eyebrow={t('auth.reset.eyebrow')}
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      caption={t('auth.secure')}
    >
      {stage === 'checking' ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}
        >
          <ActivityIndicator color={colors.accent.fill} />
          <Text variant="small" tone="muted">
            {t('auth.reset.checking')}
          </Text>
        </View>
      ) : null}
      {stage === 'invalid' ? (
        <>
          <Notice
            tone="error"
            title={t('auth.reset.invalidTitle')}
            message={t('auth.reset.invalidBody')}
          />
          <TextLink label={t('auth.reset.requestNew')} href="/forgot-password" />
        </>
      ) : null}
      {stage === 'done' ? (
        <>
          <Notice tone="success" title={t('auth.reset.doneTitle')} message={t('auth.reset.doneBody')} />
          <Button label={t('auth.reset.logIn')} onPress={() => router.replace('/log-in')} />
        </>
      ) : null}
      {stage === 'form' ? (
        <>
          <View style={{ gap: space[16] }}>
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <TextField
                  ref={field.ref}
                  label={t('auth.fields.newPassword')}
                  value={field.value}
                  onChangeText={(value) => {
                    field.onChange(value);
                    if (getFieldState('confirmPassword').isTouched) {
                      void trigger('confirmPassword');
                    }
                  }}
                  onBlur={field.onBlur}
                  error={errors.password?.message ? t(errors.password.message) : undefined}
                  hint={t('auth.passwordHint')}
                  hintMet={password.length >= 8}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field }) => (
                <TextField
                  ref={(input) => {
                    field.ref(input);
                    confirmRef.current = input;
                  }}
                  label={t('auth.fields.confirmPassword')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={
                    errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined
                  }
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
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
          {formError ? <Notice tone="error" title={t(formError)} /> : null}
          <Button label={t('auth.reset.submit')} onPress={submit} loading={isSubmitting} />
        </>
      ) : null}
    </AuthLayout>
  );
}
