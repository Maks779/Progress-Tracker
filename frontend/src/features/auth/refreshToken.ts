import * as SecureStore from 'expo-secure-store';

import { CLIENT_KIND } from '@/shared/api/fetcher';
import { storage } from '@/shared/storage/storage';

const KEY = 'ember.refresh_token';
const WEB_SESSION_KEY = 'ember.session';
const onDevice = CLIENT_KIND === 'native';

/**
 * Where the refresh token lives. Phones keep it in the Keychain / Keystore through
 * expo-secure-store; on the web it is an httpOnly cookie the app can never read, so the web
 * keeps only a note that a session exists and whose it is (an account ID, no secret), to open
 * offline like a phone does and to notice when another tab signs out or in.
 */
export const refreshTokenStore = {
  get(): Promise<string | null> {
    return onDevice ? SecureStore.getItemAsync(KEY) : Promise.resolve(null);
  },
  set(token: string): Promise<void> {
    return onDevice ? SecureStore.setItemAsync(KEY, token) : Promise.resolve();
  },
  clear(): Promise<void> {
    return onDevice ? SecureStore.deleteItemAsync(KEY) : storage.remove(WEB_SESSION_KEY);
  },
  /** The web notes after every sign-in and renewal that the browser holds a session cookie. */
  remember(userId: string | null): Promise<void> {
    return onDevice ? Promise.resolve() : storage.write(WEB_SESSION_KEY, userId ?? true);
  },
  /** Whether this device holds a session: the saved token on phones, the note on the web. */
  async exists(): Promise<boolean> {
    return onDevice ? (await SecureStore.getItemAsync(KEY)) !== null : (await storage.read<unknown>(WEB_SESSION_KEY)) !== null;
  },
};

/** What another tab of this browser did to the session: signed out, or signed in as someone. */
export type ElsewhereChange = { signedOut: true } | { signedOut: false; userId: string | null };

function changeOf(value: string | null): ElsewhereChange {
  if (value === null) {
    return { signedOut: true };
  }
  try {
    const saved: unknown = JSON.parse(value);
    return { signedOut: false, userId: typeof saved === 'string' ? saved : null };
  } catch {
    return { signedOut: false, userId: null };
  }
}

/**
 * The web: calls `listener` when another tab of this browser signs out (or its session ends),
 * or signs in again, maybe as another account. Tabs share the one refresh cookie, so a tab must
 * follow. Phones run one copy of the app, so there it never fires.
 */
export function onSessionChangedElsewhere(listener: (change: ElsewhereChange) => void): void {
  if (onDevice || typeof window === 'undefined') {
    return;
  }
  window.addEventListener('storage', (event) => {
    if (event.key === null) {
      listener({ signedOut: true });
    } else if (event.key === WEB_SESSION_KEY) {
      listener(changeOf(event.newValue));
    }
  });
}
