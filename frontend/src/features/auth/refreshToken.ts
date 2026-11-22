import * as SecureStore from 'expo-secure-store';

import { CLIENT_KIND } from '@/shared/api/fetcher';

const KEY = 'ember.refresh_token';
const onDevice = CLIENT_KIND === 'native';

/**
 * Where the refresh token lives. Phones keep it in the Keychain / Keystore through
 * expo-secure-store; on the web it is an httpOnly cookie the app can never read.
 */
export const refreshTokenStore = {
  get(): Promise<string | null> {
    return onDevice ? SecureStore.getItemAsync(KEY) : Promise.resolve(null);
  },
  set(token: string): Promise<void> {
    return onDevice ? SecureStore.setItemAsync(KEY, token) : Promise.resolve();
  },
  clear(): Promise<void> {
    return onDevice ? SecureStore.deleteItemAsync(KEY) : Promise.resolve();
  },
};
