import { useReadMe } from '@/shared/api/generated/endpoints/me/me';

import { useAuthStore } from './store';

/**
 * The signed-in account's ID: the one the access token was issued to, else the profile's (it
 * loads, or was saved on the device, while the app opens offline without a token). The token
 * comes first because saved data can belong to an account that signed out on this device.
 */
export function useAccountId(): string | undefined {
  const signedIn = useAuthStore((state) => state.status === 'signedIn');
  const userId = useAuthStore((state) => state.userId);
  const me = useReadMe({ query: { enabled: signedIn } });
  if (!signedIn) {
    return undefined;
  }
  return userId ?? (me.data?.status === 200 ? me.data.data.id : undefined);
}
