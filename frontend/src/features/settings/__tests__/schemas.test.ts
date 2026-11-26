import { changePasswordSchema, nameSchema } from '../schemas';

function messages(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]));
}

describe('nameSchema', () => {
  it('trims the name', () => {
    expect(nameSchema.parse({ name: '  Alex  ' })).toEqual({ name: 'Alex' });
  });

  it('follows the sign-up limits', () => {
    expect(messages(nameSchema.safeParse({ name: ' ' }))).toEqual({ name: 'auth.errors.nameRequired' });
    expect(messages(nameSchema.safeParse({ name: 'A'.repeat(51) }))).toEqual({ name: 'auth.errors.nameTooLong' });
  });
});

describe('changePasswordSchema', () => {
  const valid = { currentPassword: 'old-password-1', password: 'Quiet-Harbor-Maple-7', confirmPassword: 'Quiet-Harbor-Maple-7' };

  it('accepts a different new password typed twice', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('asks for every field', () => {
    const result = changePasswordSchema.safeParse({ currentPassword: '', password: '', confirmPassword: '' });

    expect(messages(result)).toMatchObject({
      currentPassword: 'auth.errors.passwordRequired',
      confirmPassword: 'auth.errors.confirmPasswordRequired',
    });
  });

  it('applies the sign-up rules to the new password', () => {
    const result = changePasswordSchema.safeParse({ ...valid, password: 'short', confirmPassword: 'short' });

    expect(messages(result).password).toBe('auth.errors.passwordTooShort');
  });

  it('refuses the current password as the new one', () => {
    const result = changePasswordSchema.safeParse({ ...valid, password: valid.currentPassword, confirmPassword: valid.currentPassword });

    expect(messages(result)).toEqual({ password: 'profile.password.sameAsCurrent' });
  });
});
