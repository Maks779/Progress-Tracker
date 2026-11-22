import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type TextInputInstance, View } from 'react-native';

import { ApiError } from '@/shared/api/fetcher';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Notice';
import { TextField } from '@/shared/ui/TextField';
import { TextLink } from '@/shared/ui/TextLink';

import { AuthLayout } from '../components/AuthLayout';
import { PasswordVisibility } from '../components/PasswordVisibility';
import { errorMessageKey, isCommonPasswordError } from '../errors';
import { type SignUpValues, signUpSchema } from '../schemas';
import { signUp } from '../session';

export function SignUpScreen() {
  const { t } = useTranslation();
  const { space } = useTheme();
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '' },
  });

  const password = useWatch({ control, name: 'password' });

  const submit = handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    try {
      await signUp(name, email, password);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'email_taken') {
        setError('email', { message: 'auth.errors.emailTaken' }, { shouldFocus: true });
      } else if (isCommonPasswordError(error)) {
        setError('password', { message: 'auth.errors.passwordTooCommon' }, { shouldFocus: true });
      } else {
        setFormError(errorMessageKey(error));
      }
    }
  });

  return (
    <AuthLayout
      eyebrow={t('auth.signUp.eyebrow')}
      title={t('auth.signUp.title')}
      subtitle={t('auth.signUp.subtitle')}
      caption={t('auth.secure')}
    >
      <View style={{ gap: space[16] }}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              ref={field.ref}
              label={t('auth.fields.name')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.name?.message ? t(errors.name.message) : undefined}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              ref={(input) => {
                field.ref(input);
                emailRef.current = input;
              }}
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
              hint={t('auth.passwordHint')}
              hintMet={password.length >= 8}
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
      <Button label={t('auth.signUp.submit')} onPress={submit} loading={isSubmitting} />
      <TextLink prefix={t('auth.signUp.haveAccount')} label={t('auth.signUp.logIn')} href="/log-in" />
    </AuthLayout>
  );
}
