import { getCalendars } from 'expo-localization';

import {
  ApiError,
  CLIENT_KIND,
  setAccessTokenProvider,
  setUnauthorizedHandler,
} from '@/shared/api/fetcher';
import { login, logout, refresh, register } from '@/shared/api/generated/endpoints/auth/auth';
import type { TokenResponse } from '@/shared/api/generated/model';
import i18n, { isLanguage } from '@/shared/i18n';

import { refreshTokenStore } from './refreshToken';
import { useAuthStore } from './store';

/**
 * `rejected`: the server refused the refresh token (expired, revoked or reused). `missing`: there
 * was no token to send (never signed in, or signed out). `unreachable`: no answer, try later.
 * The web cannot read its httpOnly cookie, so only the server's `no_session` code tells
 * `missing` apart from `rejected` there.
 */
export type RefreshResult = 'refreshed' | 'rejected' | 'missing' | 'unreachable';

type LockManager = { request<T>(name: string, task: () => Promise<T>): Promise<T> };

let pending: Promise<RefreshResult> | null = null;

async function accept(tokens: TokenResponse): Promise<void> {
  if (tokens.refresh_token) {
    await refreshTokenStore.set(tokens.refresh_token);
  }
  useAuthStore.getState().setSignedIn(tokens.access_token);
}

/** Browser tabs share one refresh cookie, so only one tab at a time may rotate it. */
function oneTabAtATime<T>(task: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as { locks?: LockManager } | undefined)?.locks;
  return locks ? locks.request('ember-auth-refresh', task) : task();
}

async function exchange(): Promise<RefreshResult> {
  const stored = await refreshTokenStore.get();
  if (CLIENT_KIND === 'native' && stored === null) {
    return 'missing';
  }
  try {
    const response = await refresh(stored === null ? null : { refresh_token: stored });
    if (response.status !== 200) {
      return 'rejected';
    }
    await accept(response.data);
    return 'refreshed';
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      await refreshTokenStore.clear();
      return error.code === 'no_session' ? 'missing' : 'rejected';
    }
    return 'unreachable';
  }
}

/**
 * Trades the refresh token for new tokens (the server rotates it every time). Callers that
 * ask at the same moment share one request: sending the same token twice would look like
 * token theft to the server, and it would revoke the session.
 */
export function refreshSession(): Promise<RefreshResult> {
  pending ??= oneTabAtATime(exchange).finally(() => {
    pending = null;
  });
  return pending;
}

/**
 * Runs at app start. Signs in again with the saved refresh token. Offline, a phone with a
 * saved token stays signed in and renews the session once the server answers.
 */
export async function restoreSession(): Promise<void> {
  const hadToken = (await refreshTokenStore.get()) !== null;
  const result = await refreshSession();
  if (result === 'refreshed') {
    return;
  }
  if (result === 'unreachable' && hadToken) {
    useAuthStore.getState().setSignedIn(null);
    return;
  }
  useAuthStore.getState().setSignedOut(result === 'rejected');
}

async function renewAfterUnauthorized(): Promise<boolean> {
  if (useAuthStore.getState().status !== 'signedIn') {
    return false;
  }
  const result = await refreshSession();
  if (result === 'rejected' || result === 'missing') {
    useAuthStore.getState().setSignedOut(true);
  }
  return result === 'refreshed';
}

/** Connects the API client to the session: it reads the access token and renews it on 401. */
export function installAuth(): void {
  setAccessTokenProvider(() => useAuthStore.getState().accessToken);
  setUnauthorizedHandler(renewAfterUnauthorized);
}

function deviceTimezone(): string {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export async function logIn(email: string, password: string): Promise<void> {
  const response = await login({ email, password });
  if (response.status !== 200) {
    throw new Error(`Unexpected log-in response ${response.status}`);
  }
  await accept(response.data);
}

/** Creates the account in the device's timezone and the language the app shows right now. */
export async function signUp(name: string, email: string, password: string): Promise<void> {
  const language = i18n.resolvedLanguage;
  const response = await register({
    name,
    email,
    password,
    timezone: deviceTimezone(),
    language: isLanguage(language) ? language : 'en',
  });
  if (response.status !== 201) {
    throw new Error(`Unexpected sign-up response ${response.status}`);
  }
  await accept(response.data);
}

/** Log out on this device. The app forgets the session even when the server cannot be reached. */
export async function signOut(): Promise<void> {
  const stored = await refreshTokenStore.get();
  await logout(stored === null ? null : { refresh_token: stored }).catch(() => undefined);
  await forgetSession();
}

/** Drops the session locally, e.g. after a password reset has signed out every device. */
export async function forgetSession(): Promise<void> {
  await refreshTokenStore.clear();
  useAuthStore.getState().setSignedOut();
}
