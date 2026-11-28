/**
 * The account an access token was issued to (its `sub` claim), or null when it cannot be read.
 * Only the server checks the signature; the app uses the subject to keep one account's data
 * and changes away from another account's session.
 */
export function subjectOf(token: string | null): string | null {
  const payload = token?.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')));
    const subject = claims && typeof claims === 'object' ? (claims as { sub?: unknown }).sub : undefined;
    return typeof subject === 'string' ? subject : null;
  } catch {
    return null;
  }
}
