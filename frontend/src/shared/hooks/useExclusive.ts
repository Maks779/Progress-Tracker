import { useCallback, useRef } from 'react';

/**
 * Wraps an async action so that calls made while it runs are ignored: a form sent by a
 * button tap and by the keyboard's Go key in the same moment is sent once. The lock is a ref,
 * because two calls in the same frame would both still see the old React state.
 */
export function useExclusive<A extends unknown[]>(
  action: (...args: A) => Promise<unknown>,
): (...args: A) => Promise<void> {
  const running = useRef(false);
  return useCallback(
    async (...args: A) => {
      if (running.current) {
        return;
      }
      running.current = true;
      try {
        await action(...args);
      } finally {
        running.current = false;
      }
    },
    [action],
  );
}
