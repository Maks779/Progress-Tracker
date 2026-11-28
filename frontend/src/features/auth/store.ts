import { create } from 'zustand';

import { subjectOf } from '@/shared/api/token';

/** `restoring` lasts from app start until the saved session is checked. */
export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  accessToken: string | null;
  userId: string | null;
  expired: boolean;
  setSignedIn: (accessToken: string | null) => void;
  setSignedOut: (expired?: boolean) => void;
};

/**
 * The session in memory. The access token never touches storage; `userId` is the account it
 * belongs to (unknown while the app opens offline without one); `expired` tells the log-in
 * screen that the session ended on its own rather than through Log out.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'restoring',
  accessToken: null,
  userId: null,
  expired: false,
  setSignedIn: (accessToken) =>
    set({ status: 'signedIn', accessToken, userId: subjectOf(accessToken), expired: false }),
  setSignedOut: (expired = false) =>
    set({ status: 'signedOut', accessToken: null, userId: null, expired }),
}));
