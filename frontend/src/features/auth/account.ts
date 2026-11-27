import { useReadMe } from '@/shared/api/generated/endpoints/me/me';

import { useAuthStore } from './store';

/** The signed-in account's ID once the profile has loaded (or was saved on the device). */
export function useAccountId(): string | undefined {
  const signedIn = useAuthStore((state) => state.status === 'signedIn');
  const me = useReadMe({ query: { enabled: signedIn } });
  return signedIn && me.data?.status === 200 ? me.data.data.id : undefined;
}
