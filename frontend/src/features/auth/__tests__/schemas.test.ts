import { logInSchema, resetPasswordSchema, signUpSchema } from '../schemas';

function messages(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('signUpSchema', () => {
  it('accepts a valid form and trims name and email', () => {
    const result = signUpSchema.safeParse({
      name: '  Alex Morgan ',
      email: ' alex@example.com ',
      password: 'correct-horse',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: 'Alex Morgan',
      email: 'alex@example.com',
      password: 'correct-horse',
    });
  });

  it('names what is wrong with each field', () => {
    const result = signUpSchema.safeParse({ name: '  ', email: 'alex@', password: 'short' });

    expect(messages(result)).toEqual({
      name: 'auth.errors.nameRequired',
      email: 'auth.errors.emailInvalid',
      password: 'auth.errors.passwordTooShort',
    });
  });

  it('asks for an email before judging its format', () => {
    const result = signUpSchema.safeParse({ name: 'Alex', email: '', password: 'correct-horse' });

    expect(messages(result)).toEqual({ email: 'auth.errors.emailRequired' });
  });

  it('follows the API limits', () => {
    const result = signUpSchema.safeParse({
      name: 'A'.repeat(51),
      email: 'alex@example.com',
      password: 'p'.repeat(129),
    });

    expect(messages(result)).toEqual({
      name: 'auth.errors.nameTooLong',
      password: 'auth.errors.passwordTooLong',
    });
  });
});

describe('logInSchema', () => {
  it('does not apply the new-password rules to an existing password', () => {
    expect(logInSchema.safeParse({ email: 'alex@example.com', password: 'short' }).success).toBe(true);
  });

  it('asks for the password', () => {
    const result = logInSchema.safeParse({ email: 'alex@example.com', password: '' });

    expect(messages(result)).toEqual({ password: 'auth.errors.passwordRequired' });
  });
});

describe('resetPasswordSchema', () => {
  it('asks to repeat the new password', () => {
    const result = resetPasswordSchema.safeParse({ password: 'correct-horse', confirmPassword: '' });

    expect(messages(result)).toEqual({ confirmPassword: 'auth.errors.confirmPasswordRequired' });
  });

  it('marks the repeated password when the two differ', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'correct-horse',
      confirmPassword: 'correct-house',
    });

    expect(messages(result)).toEqual({ confirmPassword: 'auth.errors.passwordsDontMatch' });
  });

  it('accepts two equal passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'correct-horse',
      confirmPassword: 'correct-horse',
    });

    expect(result.success).toBe(true);
  });
});
