import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { PasswordVisibility } from '@/features/auth/components/PasswordVisibility';
import { errorMessageKey } from '@/features/auth/errors';
import { forgetSession } from '@/features/auth/session';
import { ApiError } from '@/shared/api/fetcher';
import { deleteAccount } from '@/shared/api/generated/endpoints/me/me';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { TriangleAlert } from '@/shared/ui/icons';
import { Notice } from '@/shared/ui/Notice';
import { Sheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';

const schema = z.object({
  password: z.string().min(1, 'auth.errors.passwordRequired').max(128, 'auth.errors.passwordTooLong'),
});

type Values = z.infer<typeof schema>;

type Props = { visible: boolean; onClose: () => void };

/**
 * Deleting the account needs the current password, and the server checks it again. On
 * success every device is signed out and the app returns to Welcome.
 */
export function DeleteAccountSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { password: '' },
  });

  function close() {
    if (isSubmitting) {
      return;
    }
    reset();
    setFormError(null);
    setShowPassword(false);
    onClose();
  }

  const submit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await deleteAccount({ password });
      await forgetSession();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invalid_credentials') {
        setError('password', { message: 'profile.delete.wrongPassword' }, { shouldFocus: true });
      } else {
        setFormError(errorMessageKey(error));
      }
    }
  });

  return (
    <Sheet visible={visible} title={t('profile.delete.title')} onClose={close}>
      <Text variant="body" tone="muted">
        {t('profile.delete.body')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
        <TriangleAlert color={colors.state.error} size={20} strokeWidth={2} />
        <Text variant="smallStrong">{t('profile.delete.permanent')}</Text>
      </View>
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            ref={field.ref}
            label={t('profile.delete.password')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message ? t(errors.password.message) : undefined}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => submit()}
            footer={
              <PasswordVisibility visible={showPassword} onToggle={() => setShowPassword((shown) => !shown)} />
            }
          />
        )}
      />
      {formError ? <Notice tone="error" title={t(formError)} /> : null}
      <Button
        label={t('profile.delete.confirm')}
        variant="destructive"
        onPress={submit}
        loading={isSubmitting}
      />
      <Button label={t('profile.delete.keep')} variant="secondary" onPress={close} disabled={isSubmitting} />
    </Sheet>
  );
}
