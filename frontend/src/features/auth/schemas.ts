import { z } from 'zod';

/**
 * Form rules, the same as the API's. Messages are translation keys, so the error under a
 * field changes language together with the rest of the screen.
 */
const email = z
  .string()
  .trim()
  .min(1, 'auth.errors.emailRequired')
  .pipe(z.email('auth.errors.emailInvalid'));

export const newPassword = z
  .string()
  .min(8, 'auth.errors.passwordTooShort')
  .max(128, 'auth.errors.passwordTooLong');

export const personName = z
  .string()
  .trim()
  .min(1, 'auth.errors.nameRequired')
  .max(50, 'auth.errors.nameTooLong');

export const signUpSchema = z.object({
  name: personName,
  email,
  password: newPassword,
});

export const logInSchema = z.object({
  email,
  password: z.string().min(1, 'auth.errors.passwordRequired').max(128, 'auth.errors.passwordTooLong'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, 'auth.errors.confirmPasswordRequired'),
  })
  .refine((values) => !values.confirmPassword || values.password === values.confirmPassword, {
    message: 'auth.errors.passwordsDontMatch',
    path: ['confirmPassword'],
  });

export type SignUpValues = z.infer<typeof signUpSchema>;
export type LogInValues = z.infer<typeof logInSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
