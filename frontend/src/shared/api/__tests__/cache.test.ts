import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';

import { CACHE_GC_TIME, forgetCache, isKept, restoreCache } from '../cache';

const answer = (data: unknown) => ({ status: 200, data, headers: new Headers({ 'content-type': 'application/json' }) });
const saved = async () => JSON.parse((await AsyncStorage.getItem('ember.cache')) ?? 'null');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('answers kept on the device', () => {
  it('are the ones the app needs to open offline', () => {
    for (const path of [
      '/api/v1/me',
      '/api/v1/trackers',
      '/api/v1/trackers/7f6c',
      '/api/v1/goals',
      '/api/v1/goals/9a1b',
      '/api/v1/stats/home',
      '/api/v1/stats/calendar',
      '/api/v1/stats/progress',
      '/api/v1/exercises/1/records',
      '/api/v1/exercises/1/progress',
      '/api/v1/exercises',
      '/api/v1/sessions/1d2e',
      '/api/v1/books',
      '/api/v1/books/9c1f',
    ]) {
      expect(isKept([path])).toBe(true);
    }
    expect(isKept(['/api/v1/sessions', { tracker_id: 'run', limit: 1 }])).toBe(true);
    expect(isKept(['/api/v1/sessions', { tracker_id: 'run', limit: 20 }])).toBe(false);
    expect(isKept(['/api/v1/sessions', { limit: 1 }])).toBe(false);
    expect(isKept(['/api/v1/sessions', { from_date: '2026-11-23', to_date: '2026-11-29', limit: 50 }, 'pages'])).toBe(true);
    expect(isKept(['/api/v1/sessions', { from_date: '2026-11-23', limit: 50 }])).toBe(false);
    for (const path of ['/api/v1/sessions', '/api/v1/export', '/api/v1/records', '/api/v1/exercises/1/last-sets', '/api/v1/health']) {
      expect(isKept([path])).toBe(false);
    }
    expect(isKept([{ path: '/api/v1/me' }])).toBe(false);
  });

  it('are saved without response headers, read back at the next start as out of date, and forgotten at sign-out', async () => {
    const first = new QueryClient();
    await restoreCache(first);
    first.setQueryData(['/api/v1/me'], answer({ id: 'me', name: 'Alex Morgan' }));
    first.setQueryData(['/api/v1/sessions', { limit: 5 }], answer({ items: [] }));
    await wait(1_100);

    const stored = await saved();
    expect(stored.clientState.queries.map((query: { queryKey: unknown[] }) => query.queryKey)).toEqual([['/api/v1/me']]);
    expect(stored.clientState.queries[0].state.data).toEqual({ status: 200, data: { id: 'me', name: 'Alex Morgan' } });

    const next = new QueryClient();
    await restoreCache(next);
    expect(next.getQueryData(['/api/v1/me'])).toEqual({ status: 200, data: { id: 'me', name: 'Alex Morgan' } });
    expect(next.getQueryCache().find({ queryKey: ['/api/v1/me'] })?.gcTime).toBe(CACHE_GC_TIME);
    expect(next.getQueryState(['/api/v1/me'])?.isInvalidated).toBe(true);

    await forgetCache();
    expect(await saved()).toBeNull();
    first.clear();
    next.clear();
  });

  it('keep the last data when a refresh failed, saved as a plain answer', async () => {
    const client = new QueryClient();
    await restoreCache(client);
    client.setQueryData(['/api/v1/me'], answer({ id: 'me' }));
    await client
      .fetchQuery({ queryKey: ['/api/v1/me'], queryFn: () => Promise.reject(new Error('offline')), retry: false, staleTime: 0 })
      .catch(() => undefined);
    expect(client.getQueryState(['/api/v1/me'])?.status).toBe('error');
    await wait(1_100);

    const [query] = (await saved()).clientState.queries;
    expect(query.state).toMatchObject({ status: 'success', error: null, data: { status: 200, data: { id: 'me' } } });
    client.clear();
  });

  it('are dropped when older than a week', async () => {
    await AsyncStorage.setItem(
      'ember.cache',
      JSON.stringify({ buster: '1', timestamp: Date.now() - 8 * 24 * 60 * 60_000, clientState: { mutations: [], queries: [] } }),
    );
    const client = new QueryClient();
    await restoreCache(client);
    expect(await saved()).toBeNull();
    client.clear();
  });
});
