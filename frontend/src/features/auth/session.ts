import { getCalendars } from 'expo-localization';

import {
  ApiError,
  CLIENT_KIND,
  setAccessTokenProvider,
  setUnauthorizedHandler,
} from '@/shared/api/fetcher';
import { login, logout, refresh, register } from '@/shared/api/generated/endpoints/auth/auth';
import type { TokenResponse } from '@/shared/api/generated/model';
import { subjectOf } from '@/shared/api/token';
import i18n, { isLanguage } from '@/shared/i18n';
import { oneTabAtATime } from '@/shared/locks';

import { type ElsewhereChange, onSessionChangedElsewhere, refreshTokenStore } from './refreshToken';
import { useAuthStore } from './store';

/**
 * `rejected`: the server refused the refresh token (expired, revoked or reused). `missing`: there
 * was no token to send (never signed in, or signed out). `unreachable`: no answer, try later.
 * `cancelled`: the session was signed out, or the browser's session became another account's,
 * while the refresh was on its way, so its answer is not used.
 * The web cannot read its httpOnly cookie, so only the server's `no_session` code tells
 * `missing` apart from `rejected` there.
 */
export type RefreshResult = 'refreshed' | 'rejected' | 'missing' | 'unreachable' | 'cancelled';

/** Answers that only say "not now" (a proxy's timeout, too many requests): the token still works. */
const TRANSIENT = new Set([408, 429]);

let pending: Promise<RefreshResult> | null = null;

/** Grows with every sign-out, so a refresh that started before one knows to drop its answer. */
let generation = 0;

async function accept(tokens: TokenResponse): Promise<void> {
  if (tokens.refresh_token) {
    await refreshTokenStore.set(tokens.refresh_token);
  }
  await refreshTokenStore.remember(subjectOf(tokens.access_token));
  useAuthStore.getState().setSignedIn(tokens.access_token);
}

/** The tab's session becomes signed out here, without asking the server to end it. */
function leaveHere(): void {
  generation += 1;
  useAuthStore.getState().setSignedOut();
}

async function exchange(): Promise<RefreshResult> {
  const started = generation;
  const stored = await refreshTokenStore.get();
  if (CLIENT_KIND === 'native' && stored === null) {
    return 'missing';
  }
  try {
    const response = await refresh(stored === null ? null : { refresh_token: stored });
    if (response.status !== 200) {
      return 'rejected';
    }
    if (started !== generation) {
      return 'cancelled';
    }
    const { userId } = useAuthStore.getState();
    if (userId !== null && subjectOf(response.data.access_token) !== userId) {
      leaveHere();
      return 'cancelled';
    }
    await accept(response.data);
    return 'refreshed';
  } catch (error) {
    if (started !== generation) {
      return 'cancelled';
    }
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && !TRANSIENT.has(error.status)) {
      await refreshTokenStore.clear();
      return error.code === 'no_session' ? 'missing' : 'rejected';
    }
    return 'unreachable';
  }
}

/**
 * Trades the refresh token for new tokens (the server rotates it every time). Callers that
 * ask at the same moment share one request: sending the same token twice would look like
 * token theft to the server, and it would revoke the session. Browser tabs share one refresh
 * cookie, so only one tab at a time rotates it. A tab that was signed in as one account and
 * gets another account's tokens back (someone signed in as them in another tab) signs out
 * instead of carrying on with the wrong account.
 */
export function refreshSession(): Promise<RefreshResult> {
  pending ??= oneTabAtATime('ember-auth-refresh', exchange).finally(() => {
    pending = null;
  });
  return pending;
}

/**
 * Runs at app start. Signs in again with the saved refresh token. Offline, a device that holds
 * a session (a saved token on phones, a remembered cookie on the web) stays signed in with the
 * data saved on it and renews the session once the server answers. A browser without the note
 * was signed out, perhaps while offline: a cookie left behind is ended on the server instead
 * of signing the next person in.
 */
export async function restoreSession(): Promise<void> {
  const hadToken = await refreshTokenStore.exists();
  if (CLIENT_KIND === 'web' && !hadToken) {
    void logout(null).catch(() => undefined);
    useAuthStore.getState().setSignedOut();
    return;
  }
  const result = await refreshSession();
  if (result === 'refreshed') {
    return;
  }
  if (result === 'cancelled') {
    if (useAuthStore.getState().status === 'restoring') {
      useAuthStore.getState().setSignedOut();
    }
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

/** Another tab signed out, or signed in as someone else: this tab's session is over too. */
function followOtherTab(change: ElsewhereChange): void {
  const { status, userId } = useAuthStore.getState();
  if (status !== 'signedIn') {
    return;
  }
  if (change.signedOut || (change.userId !== null && userId !== null && change.userId !== userId)) {
    leaveHere();
  }
}

/** Connects the API client to the session: it reads the access token and renews it on 401. */
export function installAuth(): void {
  setAccessTokenProvider(() => useAuthStore.getState().accessToken);
  setUnauthorizedHandler(renewAfterUnauthorized);
  onSessionChangedElsewhere(followOtherTab);
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
  generation += 1;
  await refreshTokenStore.clear();
  useAuthStore.getState().setSignedOut();
}
