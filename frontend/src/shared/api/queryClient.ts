import { QueryClient } from '@tanstack/react-query';

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
