import { subjectOf } from '../token';

function jwt(claims: object): string {
  const part = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.signature`;
}

describe('subjectOf', () => {
  it('reads the account an access token belongs to', () => {
    expect(subjectOf(jwt({ sub: '0b8f1c2e-6d1a-4a57-9f2b-3c4d5e6f7a8b', fid: 'family', type: 'access' }))).toBe(
      '0b8f1c2e-6d1a-4a57-9f2b-3c4d5e6f7a8b',
    );
  });

  it('reads payloads that need base64url characters and padding', () => {
    expect(subjectOf(jwt({ sub: 'ü?>~', pad: 'x' }))).toBe('ü?>~');
  });

  it.each([null, '', 'not-a-token', 'a.%%%.c', `a.${btoa('[1,2]')}.c`, `a.${btoa(JSON.stringify({ sub: 7 }))}.c`])(
    'gives null for something that is not an access token: %p',
    (token) => {
      expect(subjectOf(token)).toBeNull();
    },
  );
});
