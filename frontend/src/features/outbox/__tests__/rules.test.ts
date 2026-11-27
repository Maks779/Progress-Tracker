import { ApiError } from '@/shared/api/fetcher';

import { failureOf, type OutboxItem, pendingFor, retryDelay } from '../rules';

function item(id: string, userId: string, queuedAt: number, failure: OutboxItem['failure'] = null): OutboxItem {
  return {
    kind: 'session',
    id,
    userId,
    queuedAt,
    revision: `r-${id}`,
    failure,
    body: { tracker_id: 'gym', started_at: '2026-11-26T17:00:00Z', local_date: '2026-11-26' },
  };
}

function apiError(status: number, errors: { field: string; code: string }[] = []): ApiError {
  return new ApiError({
    type: 'about:blank',
    title: 'Error',
    status,
    code: 'error',
    errors: errors.map((error) => ({ ...error, message: '' })),
  });
}

describe('the queue', () => {
  it('sends one account’s waiting changes oldest first and leaves refused ones for the person', () => {
    const items = [item('c', 'me', 3), item('a', 'me', 1), item('x', 'other', 0), item('b', 'me', 2, 'refused')];
    expect(pendingFor(items, 'me').map((entry) => entry.id)).toEqual(['a', 'c']);
    expect(pendingFor(items, 'nobody')).toEqual([]);
  });

  it('waits 5 s after the first failed round, doubling up to 5 minutes, give or take a fifth', () => {
    expect([1, 2, 3, 4, 7, 20].map((failures) => retryDelay(failures, 0.5))).toEqual([5_000, 10_000, 20_000, 40_000, 300_000, 300_000]);
    expect(retryDelay(1, 0)).toBe(4_000);
    expect(retryDelay(1, 1)).toBe(6_000);
    expect(retryDelay(0, 0.5)).toBe(5_000);
  });
});

describe('a failed send', () => {
  it('is tried again later without a connection, a session, or a working server', () => {
    for (const status of [0, 401, 408, 429, 500, 503]) {
      expect(failureOf('session', apiError(status))).toBeNull();
    }
    expect(failureOf('session', new Error('unexpected'))).toBeNull();
  });

  it('is refused for good when its session, tracker or exercise is gone, or the server will not take it', () => {
    expect(failureOf('session', apiError(404))).toBe('session_gone');
    expect(failureOf('exercise', apiError(404))).toBe('exercise_gone');
    expect(failureOf('session', apiError(422, [{ field: 'tracker_id', code: 'not_found' }]))).toBe('tracker_gone');
    expect(failureOf('session', apiError(422, [{ field: 'strength.exercises[1].exercise_id', code: 'not_found' }]))).toBe('exercise_gone');
    expect(failureOf('session', apiError(422, [{ field: 'started_at', code: 'in_future' }]))).toBe('refused');
    expect(failureOf('exercise', apiError(409))).toBe('refused');
    expect(failureOf('book', apiError(404))).toBe('book_gone');
    expect(failureOf('session', apiError(422, [{ field: 'reading.book_id', code: 'not_found' }]))).toBe('book_gone');
  });
});
