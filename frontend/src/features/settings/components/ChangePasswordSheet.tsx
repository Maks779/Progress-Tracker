import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TextInputInstance } from 'react-native';

import { PasswordVisibility } from '@/features/auth/components/PasswordVisibility';
import { errorMessageKey, isCommonPasswordError } from '@/features/auth/errors';
import { ApiError } from '@/shared/api/fetcher';
import { changePassword } from '@/shared/api/generated/endpoints/me/me';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Notice';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';

import { type ChangePasswordValues, changePasswordSchema } from '../schemas';

type Props = { onClose: () => void };

const EMPTY: ChangePasswordValues = { currentPassword: '', password: '', confirmPassword: '' };

/**
 * Change password: the server checks the current one, signs out every other device and keeps
 * this one signed in, which the sheet says once it is done. Rendered only while open, so
 * every opening starts empty.
 */
export function ChangePasswordSheet({ onClose }: Props) {
  const { t } = useTranslation();
  const newRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);
  const [done, setDone] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    trigger,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  });
  const password = useWatch({ control, name: 'password' });

  function close() {
    if (!isSubmitting) {
      onClose();
    }
  }

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await changePassword({ current_password: values.currentPassword, new_password: values.password });
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invalid_credentials') {
        setError('currentPassword', { message: 'profile.wrongPassword' }, { shouldFocus: true });
      } else if (isCommonPasswordError(error)) {
        setError('password', { message: 'auth.errors.passwordTooCommon' }, { shouldFocus: true });
      } else {
        setFormError(errorMessageKey(error));
      }
    }
  });

  const secret = {
    secureTextEntry: !showPasswords,
    autoCapitalize: 'none' as const,
    autoCorrect: false,
  };

  return (
    <Sheet visible title={t('profile.password.title')} onClose={close}>
      {done ? (
        <>
          <Notice tone="success" title={t('profile.password.doneTitle')} message={t('profile.password.doneBody')} />
          <Button label={t('profile.password.done')} onPress={onClose} />
        </>
      ) : (
        <>
          <Text variant="small" tone="muted">
            {t('profile.password.body')}
          </Text>
          <Controller
            control={control}
            name="currentPassword"
            render={({ field }) => (
              <TextField
                ref={field.ref}
                label={t('profile.password.current')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.currentPassword?.message ? t(errors.currentPassword.message) : undefined}
                {...secret}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => newRef.current?.focus()}
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
                  newRef.current = input;
                }}
                label={t('profile.password.new')}
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
                {...secret}
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
                label={t('profile.password.repeat')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
                {...secret}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={() => submit()}
                footer={
                  <PasswordVisibility
                    visible={showPasswords}
                    onToggle={() => setShowPasswords((shown) => !shown)}
                  />
                }
              />
            )}
          />
          {formError ? <Notice tone="error" title={t(formError)} /> : null}
          <Button label={t('profile.password.submit')} onPress={submit} loading={isSubmitting} />
          <Button label={t('profile.name.cancel')} variant="secondary" onPress={close} disabled={isSubmitting} />
        </>
      )}
    </Sheet>
  );
}
