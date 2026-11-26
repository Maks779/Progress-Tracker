import { act, renderHook } from '@testing-library/react-native';

import { useOneAtATime } from '../useOneAtATime';

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('useOneAtATime', () => {
  it('ignores a second tap that lands before React re-renders', async () => {
    const { result } = await renderHook(() => useOneAtATime());
    const first = deferred();
    const second = jest.fn(async () => undefined);
    let outcomes: boolean[] = [];

    await act(async () => {
      const a = result.current.run('everything', () => first.promise);
      const b = result.current.run('gym', second);
      first.resolve();
      outcomes = await Promise.all([a, b]);
    });

    expect(outcomes).toEqual([true, false]);
    expect(second).not.toHaveBeenCalled();
  });

  it('says what runs, and frees the lock afterwards, also after a failure', async () => {
    const { result } = await renderHook(() => useOneAtATime());
    const task = deferred();
    let running: Promise<boolean> = Promise.resolve(false);

    await act(async () => {
      running = result.current.run('gym', () => task.promise);
    });
    expect(result.current.busy).toBe('gym');

    await act(async () => {
      task.resolve();
      await running;
    });
    expect(result.current.busy).toBeNull();

    await act(async () => {
      await result.current.run('books', async () => Promise.reject(new Error('offline'))).catch(() => undefined);
    });
    expect(result.current.busy).toBeNull();
    let again = false;
    await act(async () => {
      again = await result.current.run('books', async () => undefined);
    });
    expect(again).toBe(true);
  });
});
