import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/features/auth/store';
import { ApiError } from '@/shared/api/fetcher';
import { updateMe } from '@/shared/api/generated/endpoints/me/me';

import { usePreferences } from '../preferences';
import { RETRY_MS, usePreferencesSync } from '../usePreferencesSync';

jest.mock('@/shared/api/generated/endpoints/me/me', () => ({
  useReadMe: () => ({ data: undefined, dataUpdatedAt: 0 }),
  getReadMeQueryKey: () => ['/api/v1/me'],
  updateMe: jest.fn(),
}));

const updateMock = updateMe as jest.Mock;
const offline = new ApiError({ type: 'about:blank', title: 'x', status: 0, code: 'network_error' });
const saved = {
  status: 200,
  headers: new Headers(),
  data: { language: 'en', theme: 'dark', weight_unit: 'kg', distance_unit: 'km' },
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  focusManager.setFocused(undefined);
  useAuthStore.setState({ status: 'signedIn', accessToken: 'token', expired: false });
  usePreferences.setState({
    values: { language: 'en', theme: 'dark', weight_unit: 'kg', distance_unit: 'km' },
    pending: ['theme'],
    hydrated: true,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePreferencesSync', () => {
  it('tries again every 30 seconds until the server can be reached', async () => {
    updateMock.mockRejectedValueOnce(offline).mockResolvedValueOnce(saved);
    await renderHook(() => usePreferencesSync(), { wrapper });
    await flush();
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(usePreferences.getState().pending).toEqual(['theme']);

    await act(async () => {
      jest.advanceTimersByTime(RETRY_MS);
    });
    await flush();

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(usePreferences.getState().pending).toEqual([]);
  });

  it('tries again when the app or tab comes back to the front', async () => {
    updateMock.mockRejectedValueOnce(offline).mockResolvedValueOnce(saved);
    await renderHook(() => usePreferencesSync(), { wrapper });
    await flush();

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await flush();

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(usePreferences.getState().pending).toEqual([]);
  });

  it('stops asking once nothing waits', async () => {
    updateMock.mockResolvedValue(saved);
    await renderHook(() => usePreferencesSync(), { wrapper });
    await flush();

    await act(async () => {
      jest.advanceTimersByTime(RETRY_MS * 3);
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('forgets unsent changes after sign-out', async () => {
    useAuthStore.setState({ status: 'signedOut', accessToken: null, expired: false });

    await renderHook(() => usePreferencesSync(), { wrapper });
    await flush();

    expect(usePreferences.getState().pending).toEqual([]);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
