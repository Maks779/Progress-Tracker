import { useCallback, useRef, useState } from 'react';

/**
 * Runs one task at a time and says which one is running. The lock is a ref, not state: two
 * taps that land before React re-renders would both still see the old state and both start.
 * A call made while a task runs is ignored and resolves to `false`.
 */
export function useOneAtATime() {
  const running = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(async (key: string, task: () => Promise<void>): Promise<boolean> => {
    if (running.current) {
      return false;
    }
    running.current = true;
    setBusy(key);
    try {
      await task();
      return true;
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, []);

  return { busy, run };
}
