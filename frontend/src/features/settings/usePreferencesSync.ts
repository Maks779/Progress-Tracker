import { focusManager, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { getReadMeQueryKey, useReadMe } from '@/shared/api/generated/endpoints/me/me';

import {
  applyServerPreferences,
  forgetPendingPreferences,
  pushPreferences,
  usePreferences,
} from './preferences';

/** While changes wait for the server, it is asked again this often. */
export const RETRY_MS = 30_000;

/**
 * Keeps the device copy and the account in step: the account's values arrive whenever the
 * profile is fetched (start, sign-in, back to the app or tab). Unsent changes go out right
 * after a change, after every successful fetch, whenever the app or tab is back in front and
 * every 30 seconds, so they leave as soon as the server can be reached again.
 */
export function usePreferencesSync(): void {
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const pending = usePreferences((state) => state.pending);
  const waiting = status === 'signedIn' && pending.length > 0;
  const me = useReadMe({ query: { enabled: status === 'signedIn' } });
  const server = me.data?.status === 200 ? me.data.data : undefined;

  const push = useCallback(() => {
    void pushPreferences().then((updated) => {
      if (updated) {
        queryClient.setQueryData(getReadMeQueryKey(), {
          data: updated,
          status: 200,
          headers: new Headers(),
        });
      }
    });
  }, [queryClient]);

  useEffect(() => {
    if (status === 'signedOut') {
      void forgetPendingPreferences();
    }
  }, [status]);

  useEffect(() => {
    if (server) {
      void applyServerPreferences(server);
    }
  }, [server]);

  useEffect(() => {
    if (waiting) {
      push();
    }
  }, [waiting, pending, me.dataUpdatedAt, push]);

  useEffect(() => {
    if (!waiting) {
      return undefined;
    }
    const stopListening = focusManager.subscribe((focused) => {
      if (focused) {
        push();
      }
    });
    const timer = setInterval(push, RETRY_MS);
    return () => {
      stopListening();
      clearInterval(timer);
    };
  }, [waiting, push]);
}
