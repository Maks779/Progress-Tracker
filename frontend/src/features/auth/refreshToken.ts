import * as SecureStore from 'expo-secure-store';

import { CLIENT_KIND } from '@/shared/api/fetcher';
import { storage } from '@/shared/storage/storage';

const KEY = 'ember.refresh_token';
const WEB_SESSION_KEY = 'ember.session';
const onDevice = CLIENT_KIND === 'native';

/**
 * Where the refresh token lives. Phones keep it in the Keychain / Keystore through
 * expo-secure-store; on the web it is an httpOnly cookie the app can never read, so the web
 * keeps only a note that a session exists (no secret), to open offline like a phone does.
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
  remember(): Promise<void> {
    return onDevice ? Promise.resolve() : storage.write(WEB_SESSION_KEY, true);
  },
  /** Whether this device holds a session: the saved token on phones, the note on the web. */
  async exists(): Promise<boolean> {
    return onDevice ? (await SecureStore.getItemAsync(KEY)) !== null : (await storage.read<boolean>(WEB_SESSION_KEY)) === true;
  },
};
