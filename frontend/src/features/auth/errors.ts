import { ApiError } from '@/shared/api/fetcher';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  email_taken: 'auth.errors.emailTaken',
  rate_limited: 'auth.errors.rateLimited',
  network_error: 'errors.network',
  timeout: 'errors.timeout',
};

/** The translation key for an error from the API, by its stable `code`. */
export function errorMessageKey(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? 'errors.unknown';
  }
  return 'errors.unknown';
}

/** The API turned the password down because it is on the list of the most common leaked ones. */
export function isCommonPasswordError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.fieldErrors.some((fieldError) => fieldError.code === 'password_too_common')
  );
}
