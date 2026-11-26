import { act, renderHook } from '@testing-library/react-native';

import { useExclusive } from '../useExclusive';

function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('useExclusive', () => {
  it('runs the action once for calls in the same moment', async () => {
    const pending = deferred();
    const action = jest.fn(() => pending.promise);
    const { result } = await renderHook(() => useExclusive(action));

    await act(async () => {
      const first = result.current();
      const second = result.current();
      pending.resolve();
      await Promise.all([first, second]);
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('runs again once the previous call has finished', async () => {
    const action = jest.fn(async () => undefined);
    const { result } = await renderHook(() => useExclusive(action));

    await act(async () => {
      await result.current();
      await result.current();
    });

    expect(action).toHaveBeenCalledTimes(2);
  });

  it('frees the lock after a failure and lets the caller see it', async () => {
    const failing = deferred();
    const action = jest.fn().mockReturnValueOnce(failing.promise).mockResolvedValueOnce(undefined);
    const { result } = await renderHook(() => useExclusive(action));

    let failure: unknown;
    await act(async () => {
      const call = result.current().catch((error: unknown) => {
        failure = error;
      });
      failing.reject(new Error('offline'));
      await call;
      await result.current();
    });

    expect(failure).toEqual(new Error('offline'));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('passes the arguments through', async () => {
    const action = jest.fn(async (_value: number) => undefined);
    const { result } = await renderHook(() => useExclusive(action));

    await act(async () => {
      await result.current(7);
    });

    expect(action).toHaveBeenCalledWith(7);
  });
});
