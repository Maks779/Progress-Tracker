import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from './fetcher';

/** Server data cache. Client errors (4xx) are not retried; network and 5xx errors once. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failures, error) => {
          const clientError = error instanceof ApiError && error.status < 500 && error.status > 0;
          return !clientError && failures < 1;
        },
      },
    },
  });
}

/**
 * On phones, coming back to the app counts as focus, as switching back to a tab does on the
 * web, so data that went stale meanwhile (the profile and its settings) is fetched again.
 */
export function followAppFocus(): void {
  if (Platform.OS === 'web') {
    return;
  }
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}
