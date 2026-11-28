import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query, QueryClient } from '@tanstack/react-query';
import {
  type PersistedClient,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
  removeOldestQuery,
} from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getReadMeQueryKey } from './generated/endpoints/me/me';

const DAY = 24 * 60 * 60_000;

/** Raise it when a saved answer's shape changes, so older copies are dropped instead of read. */
const CACHE_VERSION = '1';

/** A saved copy older than this is dropped at start-up. */
export const CACHE_MAX_AGE = 7 * DAY;

/** Restored answers stay in memory this long even when no screen shows them. */
export const CACHE_GC_TIME = DAY;

/**
 * The answers the app needs to open offline: the account, trackers, goals, Home's numbers,
 * the exercise catalog, books, single sessions (the workout that Start repeats, History's
 * details), each tracker's latest session (what a quick log repeats), the months and weeks
 * History showed, Progress's overview and lines, and each exercise's bests (records in an
 * offline workout). Other lists and exports are left out.
 */
const KEPT =
  /^\/api\/v1\/(me|trackers(\/[^/]+)?|goals(\/[^/]+)?|stats\/(home|calendar|progress)|exercises(\/[^/]+\/(records|progress))?|books(\/[^/]+)?|sessions\/[^/]+)$/;

export function isKept(queryKey: readonly unknown[]): boolean {
  const [path, params] = queryKey;
  if (path === '/api/v1/sessions') {
    const query = params as { tracker_id?: string; limit?: number; from_date?: string; to_date?: string } | undefined;
    const week = Boolean(query?.from_date && query.to_date);
    return week || (Boolean(query?.tracker_id) && query?.limit === 1);
  }
  return typeof path === 'string' && KEPT.test(path);
}

/** An answer whose last refresh failed (the server was down) is still the last known data. */
function shouldKeep(query: Query): boolean {
  return query.state.data !== undefined && isKept(query.queryKey);
}

/** Saved answers are stored as plain data: a failed refresh and the response headers are left out. */
export function serializeCache(client: PersistedClient): string {
  const queries = client.clientState.queries.map((query) =>
    query.state.status === 'error'
      ? { ...query, state: { ...query.state, status: 'success' as const, error: null, fetchFailureCount: 0, fetchFailureReason: null } }
      : query,
  );
  return JSON.stringify({ ...client, clientState: { ...client.clientState, queries } }, (key, value: unknown) =>
    key === 'headers' && typeof value === 'object' ? undefined : value,
  );
}

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'ember.cache',
  throttleTime: 1000,
  serialize: serializeCache,
  retry: removeOldestQuery,
});

let stopSaving: (() => void) | undefined;

/**
 * Loads the answers saved at the last visit, then keeps saving them (at most once a second),
 * so the app opens with the last known data when the server cannot be reached. Restored
 * answers count as out of date: screens show them at once and ask the server again. A copy
 * that cannot be read is dropped; storage that fails only costs the saved copy.
 */
export async function restoreCache(queryClient: QueryClient): Promise<void> {
  await persistQueryClientRestore({
    queryClient,
    persister,
    maxAge: CACHE_MAX_AGE,
    buster: CACHE_VERSION,
    hydrateOptions: { defaultOptions: { queries: { gcTime: CACHE_GC_TIME } } },
  }).catch(() => undefined);
  await queryClient.invalidateQueries({ refetchType: 'none' });
  stopSaving?.();
  stopSaving = persistQueryClientSubscribe({
    queryClient,
    persister,
    buster: CACHE_VERSION,
    dehydrateOptions: { shouldDehydrateQuery: shouldKeep },
  });
}

/** Sign-out: nothing of the account stays on the device for the next person. */
export async function forgetCache(): Promise<void> {
  await Promise.resolve(persister.removeClient()).catch(() => undefined);
}

/** The account the data in memory belongs to, as far as the saved profile tells. */
export function savedAccountId(queryClient: QueryClient): string | undefined {
  const me = queryClient.getQueryData<{ status: number; data?: { id?: unknown } }>(getReadMeQueryKey());
  const id = me?.status === 200 ? me.data?.id : undefined;
  return typeof id === 'string' ? id : undefined;
}
