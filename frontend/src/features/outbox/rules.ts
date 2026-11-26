import { ApiError } from '@/shared/api/fetcher';
import type { ExerciseWrite, SessionWrite } from '@/shared/api/generated/model';

/**
 * Why the server refused a change for good: its tracker or the session itself was deleted on
 * another device, an exercise it uses is gone, or anything else it would not accept.
 */
export type FailureCode = 'tracker_gone' | 'session_gone' | 'exercise_gone' | 'refused';

type Base = {
  id: string;
  userId: string;
  /** Keeps the order: changes are sent as they were made. */
  queuedAt: number;
  /** New with every change of the body, so a send that is overtaken by a newer change keeps it. */
  revision: string;
  failure: FailureCode | null;
};

export type SessionItem = Base & { kind: 'session'; body: SessionWrite };
export type ExerciseItem = Base & { kind: 'exercise'; body: ExerciseWrite };
export type OutboxItem = SessionItem | ExerciseItem;
export type OutboxKind = OutboxItem['kind'];

export const FIRST_RETRY_MS = 5_000;
export const MAX_RETRY_MS = 5 * 60_000;

/** The changes of one account still to send, oldest first; refused ones wait for the person. */
export function pendingFor(items: OutboxItem[], userId: string): OutboxItem[] {
  return items.filter((item) => item.userId === userId && item.failure === null).sort(byQueue);
}

export function byQueue(a: OutboxItem, b: OutboxItem): number {
  return a.queuedAt - b.queuedAt;
}

/**
 * The wait before the next try after `failures` failed rounds in a row: 5 s, doubling up to
 * 5 minutes, give or take a fifth (`random` in 0..1), so devices do not all retry at once.
 */
export function retryDelay(failures: number, random: number): number {
  const base = Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** Math.max(0, failures - 1));
  return Math.round(base * (0.8 + 0.4 * random));
}

/**
 * What a failed send means. `null`: try again later (no connection, the session needs signing
 * in again, too many requests, a server error). Otherwise the server refused the change and
 * repeating it would not help.
 */
export function failureOf(kind: OutboxKind, error: unknown): FailureCode | null {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const { status, fieldErrors } = error;
  if (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) {
    return null;
  }
  if (status === 404) {
    return kind === 'session' ? 'session_gone' : 'exercise_gone';
  }
  if (fieldErrors.some((field) => field.field === 'tracker_id' && field.code === 'not_found')) {
    return 'tracker_gone';
  }
  if (fieldErrors.some((field) => field.field.endsWith('exercise_id') && field.code === 'not_found')) {
    return 'exercise_gone';
  }
  return 'refused';
}
