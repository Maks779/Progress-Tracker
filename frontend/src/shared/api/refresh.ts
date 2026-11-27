import type { QueryClient } from '@tanstack/react-query';

const ACCOUNT_DATA = [
  '/api/v1/trackers',
  '/api/v1/goals',
  '/api/v1/me',
  '/api/v1/stats',
  '/api/v1/sessions',
  '/api/v1/books',
  '/api/v1/records',
  '/api/v1/exercises',
];

/**
 * Marks every cached answer about trackers, goals, sessions, books, stats, records, exercises
 * and the account as stale after a change, so the screens on show load again and the others
 * reload when they open.
 * Generated query keys start with the request path, e.g. ['/api/v1/trackers/<id>'].
 */
export function refreshAccountData(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      typeof queryKey[0] === 'string' && ACCOUNT_DATA.some((path) => (queryKey[0] as string).startsWith(path)),
  });
}
