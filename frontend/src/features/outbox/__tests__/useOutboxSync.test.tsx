import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { useConnection } from '@/shared/api/connection';
import { ApiError } from '@/shared/api/fetcher';
import { putSession } from '@/shared/api/generated/endpoints/sessions/sessions';
import type { SessionWrite } from '@/shared/api/generated/model';

import { enqueue, useOutbox } from '../outbox';
import { useOutboxSync } from '../useOutboxSync';

jest.mock('@/shared/api/generated/endpoints/me/me', () => ({ useReadMe: () => ({ data: { status: 200, data: { id: 'me' } } }) }));
jest.mock('@/shared/api/generated/endpoints/sessions/sessions', () => ({ putSession: jest.fn() }));
jest.mock('@/shared/api/generated/endpoints/exercises/exercises', () => ({
  putExercise: jest.fn(),
  getListExercisesQueryKey: () => ['/api/v1/exercises'],
}));

const BODY: SessionWrite = { tracker_id: 'gym', started_at: '2026-11-26T17:00:00Z', local_date: '2026-11-26' };
const offline = () => new ApiError({ type: 'about:blank', title: 'Offline', status: 0, code: 'network_error' });
const saved = () => ({ status: 201, data: { session: { id: 'one' } }, headers: new Headers() }) as never;

let client: QueryClient;

async function start() {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useOutboxSync(), { wrapper });
}

const tick = (ms: number) => act(async () => {
  await jest.advanceTimersByTimeAsync(ms);
});

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  client = new QueryClient();
  useAuthStore.setState({ status: 'signedIn' });
  useConnection.setState({ online: true, reachable: true });
  useOutbox.setState({ hydrated: true, items: [], syncing: false, retryAt: null });
});

afterEach(() => {
  client.clear();
  jest.useRealTimers();
});

describe('syncing the outbox', () => {
  it('sends what waits as soon as the account is known, then refreshes the screens once', async () => {
    jest.mocked(putSession).mockResolvedValue(saved());
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await start();
    await tick(0);

    expect(putSession).toHaveBeenCalledWith('one', BODY);
    expect(useOutbox.getState().items).toEqual([]);
    expect(invalidate).not.toHaveBeenCalled();
    await tick(250);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['/api/v1/exercises'] });
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ predicate: expect.any(Function) }));
  });

  it('waits for a signed-in account', async () => {
    useAuthStore.setState({ status: 'signedOut' });
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await start();
    await tick(0);
    expect(putSession).not.toHaveBeenCalled();
  });

  it('tries again at the planned time, when the app comes back to the front, and when the network is back', async () => {
    jest.mocked(putSession).mockRejectedValue(offline());
    await enqueue({ kind: 'session', id: 'one', userId: 'me', body: BODY });
    await start();
    await tick(0);
    expect(putSession).toHaveBeenCalledTimes(1);

    await tick(6_100);
    expect(putSession).toHaveBeenCalledTimes(2);

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await tick(0);
    expect(putSession).toHaveBeenCalledTimes(3);
    focusManager.setFocused(undefined);

    jest.mocked(putSession).mockResolvedValue(saved());
    await act(async () => useConnection.setState({ reachable: false }));
    await tick(0);
    await act(async () => useConnection.setState({ reachable: true }));
    await tick(0);
    expect(putSession).toHaveBeenCalledTimes(5);
    expect(useOutbox.getState()).toMatchObject({ items: [], retryAt: null });
  });
});
