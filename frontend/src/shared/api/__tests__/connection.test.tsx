import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { isOffline, useConnection } from '../connection';
import { apiFetch } from '../fetcher';
import { health } from '../generated/endpoints/system/system';
import { PROBE_MS, useServerProbe } from '../useServerProbe';

jest.mock('../generated/endpoints/system/system', () => ({ health: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  useConnection.setState({ online: true, reachable: true });
});

describe('the connection', () => {
  it('is offline without a network or while the server does not answer', () => {
    expect(isOffline({ online: true, reachable: true })).toBe(false);
    expect(isOffline({ online: false, reachable: true })).toBe(true);
    expect(isOffline({ online: true, reachable: false })).toBe(true);
  });

  it('learns from every request whether the server answers; an error answer counts', async () => {
    const fetchMock = jest.fn().mockRejectedValueOnce(new TypeError('Network request failed'));
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(apiFetch('/api/v1/health')).rejects.toMatchObject({ status: 0 });
    expect(useConnection.getState().reachable).toBe(false);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers(), text: async () => '' });
    await expect(apiFetch('/api/v1/health')).rejects.toMatchObject({ status: 503 });
    expect(useConnection.getState().reachable).toBe(true);
  });
});

describe('asking the server again', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    jest.useFakeTimers();
    client = new QueryClient();
    jest.mocked(health).mockResolvedValue({ status: 200, data: { status: 'ok' } } as never);
  });

  afterEach(() => {
    client.clear();
    jest.useRealTimers();
  });

  it('happens every 15 seconds while the device is online and the server silent, and reloads the screens once it answers', async () => {
    const refetch = jest.spyOn(client, 'refetchQueries');
    await renderHook(() => useServerProbe(true), { wrapper });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PROBE_MS);
    });
    expect(health).not.toHaveBeenCalled();

    await act(async () => useConnection.setState({ reachable: false }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PROBE_MS);
    });
    expect(health).toHaveBeenCalledTimes(1);

    await act(async () => useConnection.setState({ reachable: true }));
    expect(refetch).toHaveBeenCalledWith({ type: 'active', stale: true });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PROBE_MS * 2);
    });
    expect(health).toHaveBeenCalledTimes(1);
  });

  it('does not happen without a network or when signed out', async () => {
    useConnection.setState({ online: false, reachable: false });
    const { rerender } = await renderHook(({ enabled }: { enabled: boolean }) => useServerProbe(enabled), {
      wrapper,
      initialProps: { enabled: true },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PROBE_MS * 2);
    });
    await rerender({ enabled: false });
    await act(async () => useConnection.setState({ online: true }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(PROBE_MS * 2);
    });
    expect(health).not.toHaveBeenCalled();
  });

  it('happens at once when the device gets its network back', async () => {
    useConnection.setState({ online: false, reachable: false });
    await renderHook(() => useServerProbe(true), { wrapper });
    await act(async () => useConnection.setState({ online: true }));
    expect(health).toHaveBeenCalledTimes(1);
  });
});
