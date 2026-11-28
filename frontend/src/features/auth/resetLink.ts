/** The route params of the reset page: Expo Router keeps the part of the URL after `#` as `#`. */
export type ResetLinkParams = { token?: string; '#'?: string };

/**
 * The token of the emailed link `/reset-password#token=…`. It sits after `#`, which browsers
 * never send to a server, so it stays out of request logs and `Referer` headers. Links with
 * `?token=` work too.
 */
export function resetTokenOf(params: ResetLinkParams): string | undefined {
  const fromHash = params['#'] ? new URLSearchParams(params['#']).get('token') : null;
  return fromHash || params.token || undefined;
}

/** Whether the address still shows a token. */
export function showsResetToken(params: ResetLinkParams): boolean {
  return Boolean(params['#'] || params.token);
}

/** Params that take the token out of the address bar and this history entry. */
export const WITHOUT_TOKEN: ResetLinkParams = { token: undefined, '#': undefined };
