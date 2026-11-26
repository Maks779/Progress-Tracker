import { z } from 'zod';

import { newPassword, personName } from '@/features/auth/schemas';

/** The same name rules as sign-up: 1–50 characters after trimming. */
export const nameSchema = z.object({ name: personName });

/**
 * Change password: the current one (checked again by the server), the new one under the
 * sign-up rules, typed twice, and different from the current one.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'auth.errors.passwordRequired')
      .max(128, 'auth.errors.passwordTooLong'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'auth.errors.confirmPasswordRequired'),
  })
  .refine((values) => !values.confirmPassword || values.password === values.confirmPassword, {
    message: 'auth.errors.passwordsDontMatch',
    path: ['confirmPassword'],
  })
  .refine((values) => values.password !== values.currentPassword, {
    message: 'profile.password.sameAsCurrent',
    path: ['password'],
  });

export type NameValues = z.infer<typeof nameSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
