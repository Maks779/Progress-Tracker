import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { errorMessageKey } from '@/features/auth/errors';
import { getReadMeQueryKey, updateMe } from '@/shared/api/generated/endpoints/me/me';
import { useExclusive } from '@/shared/hooks/useExclusive';
import { Button } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Notice';
import { Sheet } from '@/shared/ui/Sheet';
import { TextField } from '@/shared/ui/TextField';

import { type NameValues, nameSchema } from '../schemas';

type Props = { name: string; onClose: () => void };

/**
 * Changes the name on the account; the account card shows the server's answer right away.
 * Rendered only while open, so every opening starts from the current name.
 */
export function EditNameSheet({ name, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    mode: 'onTouched',
    defaultValues: { name },
  });

  function close() {
    if (!isSubmitting) {
      onClose();
    }
  }

  const submit = useExclusive(handleSubmit(async (values) => {
    setFormError(null);
    try {
      const response = await updateMe({ name: values.name });
      queryClient.setQueryData(getReadMeQueryKey(), response);
      onClose();
    } catch (error) {
      setFormError(errorMessageKey(error));
    }
  }));

  return (
    <Sheet visible title={t('profile.name.title')} onClose={close}>
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
            returnKeyType="done"
            onSubmitEditing={() => submit()}
          />
        )}
      />
      {formError ? <Notice tone="error" title={t(formError)} /> : null}
      <Button label={t('profile.name.save')} onPress={submit} loading={isSubmitting} />
      <Button label={t('profile.name.cancel')} variant="secondary" onPress={close} disabled={isSubmitting} />
    </Sheet>
  );
}
