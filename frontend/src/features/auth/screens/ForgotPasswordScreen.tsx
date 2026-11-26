import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { forgotPassword } from '@/shared/api/generated/endpoints/auth/auth';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Notice';
import { TextField } from '@/shared/ui/TextField';
import { TextLink } from '@/shared/ui/TextLink';

import { AuthLayout } from '../components/AuthLayout';
import { errorMessageKey } from '../errors';
import { type ForgotPasswordValues, forgotPasswordSchema } from '../schemas';
import { useCountdown } from '../useCountdown';

/** The server sends at most one email a minute per account, so the button waits as long. */
export const RESEND_AFTER_SECONDS = 60;

/**
 * The answer is the same whether or not the account exists, so the form reveals nothing.
 * Once a link is sent the form is replaced by the result, so a second tap cannot resend it.
 */
export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const countdown = useCountdown(RESEND_AFTER_SECONDS);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  async function send(email: string): Promise<boolean> {
    setFormError(null);
    try {
      await forgotPassword({ email });
      countdown.restart();
      return true;
    } catch (error) {
      setFormError(errorMessageKey(error));
      return false;
    }
  }

  const submit = useExclusive(handleSubmit(async ({ email }) => {
    if (await send(email)) {
      setSentTo(email);
    }
  }));

  async function resend() {
    if (!sentTo) {
      return;
    }
    setResending(true);
    await send(sentTo);
    setResending(false);
  }

  function changeEmail() {
    setFormError(null);
    setSentTo(null);
  }

  return (
    <AuthLayout
      eyebrow={t('auth.forgot.eyebrow')}
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      caption={t('auth.secure')}
    >
      {sentTo ? (
        <Fragment key="sent">
          <Notice
            tone="success"
            title={t('auth.forgot.sentTitle')}
            message={t('auth.forgot.sentBody', { email: sentTo })}
          />
          {formError ? <Notice tone="error" title={t(formError)} /> : null}
          <Button
            variant="secondary"
            label={
              countdown.left > 0
                ? t('auth.forgot.resendIn', { seconds: countdown.left })
                : t('auth.forgot.resend')
            }
            onPress={resend}
            disabled={countdown.left > 0}
            loading={resending}
          />
          <TextLink label={t('auth.forgot.otherEmail')} onPress={changeEmail} />
        </Fragment>
      ) : (
        <Fragment key="form">
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
                returnKeyType="send"
                onSubmitEditing={() => submit()}
              />
            )}
          />
          {formError ? <Notice tone="error" title={t(formError)} /> : null}
          <Button label={t('auth.forgot.submit')} onPress={submit} loading={isSubmitting} />
        </Fragment>
      )}
      <TextLink label={t('auth.forgot.back')} href="/log-in" tone="primary" />
    </AuthLayout>
  );
}
