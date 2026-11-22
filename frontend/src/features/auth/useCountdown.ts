import { useCallback, useEffect, useState } from 'react';

/** Seconds left until an action may run again; `restart()` starts a new wait. */
export function useCountdown(seconds: number): { left: number; restart: () => void } {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const restart = useCallback(() => setLeft(seconds), [seconds]);
  return { left, restart };
}
