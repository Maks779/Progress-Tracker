import { focusManager, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { isOffline, useConnection } from './connection';
import { health } from './generated/endpoints/system/system';

/** While the server does not answer, it is asked again this often. */
export const PROBE_MS = 15_000;

/**
 * When the device has a network but the server stopped answering, asks it again every 15
 * seconds while the app is in front, and at once when the device gets its network back. Once
 * it answers, the screens on show load whatever failed or went stale meanwhile.
 */
export function useServerProbe(enabled: boolean): void {
  const queryClient = useQueryClient();
  const waiting = useConnection((state) => enabled && state.online && !state.reachable);

  useEffect(() => {
    if (!waiting) {
      return undefined;
    }
    const timer = setInterval(() => {
      if (focusManager.isFocused()) {
        health().catch(() => undefined);
      }
    }, PROBE_MS);
    return () => clearInterval(timer);
  }, [waiting]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    return useConnection.subscribe((state, previous) => {
      if (isOffline(previous) && !isOffline(state)) {
        void queryClient.refetchQueries({ type: 'active', stale: true });
      } else if (!previous.online && state.online && !state.reachable) {
        health().catch(() => undefined);
      }
    });
  }, [enabled, queryClient]);
}
