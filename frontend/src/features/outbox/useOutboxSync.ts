import { focusManager, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAccountId } from '@/features/auth/account';
import { useConnection, useOffline } from '@/shared/api/connection';
import { getListExercisesQueryKey } from '@/shared/api/generated/endpoints/exercises/exercises';
import { refreshAccountData } from '@/shared/api/refresh';

import { flushOutbox, onSaved, useOutbox } from './outbox';
import { pendingFor } from './rules';

/** Saved changes in quick succession refresh the screens once. */
const REFRESH_DELAY_MS = 250;

/**
 * Sends the signed-in account's waiting changes: at start-up and sign-in, when a change is
 * added, when the device or the server is back, when the app or tab comes to the front, and
 * at the planned retry. Saved changes refresh the data on screen, the exercise catalog too
 * (its "last used" dates change with every workout).
 */
export function useOutboxSync(): void {
  const queryClient = useQueryClient();
  const accountId = useAccountId();
  const waiting = useOutbox((state) => (accountId ? pendingFor(state.items, accountId).length : 0));
  const retryAt = useOutbox((state) => state.retryAt);
  const online = useConnection((state) => state.online);
  const offline = useOffline();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = onSaved(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshAccountData(queryClient);
        void queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
      }, REFRESH_DELAY_MS);
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [queryClient]);

  useEffect(() => {
    if (accountId && waiting > 0) {
      void flushOutbox(accountId);
    }
  }, [accountId, waiting, online, offline]);

  useEffect(() => {
    if (!accountId || waiting === 0) {
      return undefined;
    }
    return focusManager.subscribe((focused) => {
      if (focused) {
        void flushOutbox(accountId);
      }
    });
  }, [accountId, waiting]);

  useEffect(() => {
    if (!accountId || waiting === 0 || retryAt === null) {
      return undefined;
    }
    const timer = setTimeout(() => void flushOutbox(accountId), Math.max(0, retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [accountId, waiting, retryAt]);
}
