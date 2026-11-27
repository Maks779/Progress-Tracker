import { type QueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { removeItem, sessionKey } from '@/features/outbox/outbox';
import { useBooks } from '@/features/quicklog/data';
import { CACHE_GC_TIME } from '@/shared/api/cache';
import { ApiError } from '@/shared/api/fetcher';
import {
  deleteSession,
  getGetSessionQueryKey,
  getListSessionsQueryKey,
  type getSessionResponse,
  listSessions,
  putSession,
  restoreSession,
  useListSessions,
} from '@/shared/api/generated/endpoints/sessions/sessions';
import { useCalendar } from '@/shared/api/generated/endpoints/stats/stats';
import { useListTrackers } from '@/shared/api/generated/endpoints/trackers/trackers';
import type { SessionListItem, SessionOut, SessionWrite } from '@/shared/api/generated/model';
import { refreshAccountData } from '@/shared/api/refresh';

import { sessionTitle, type Week } from './rules';

/** Sessions asked for at a time in a week's list; more come with Show more. */
export const WEEK_PAGE = 50;

/** The month's calendar: days with sessions and their tracker types, the count and active time. Kept on the device. */
export function useMonth(month: string, trackerId: string | null) {
  return useCalendar({ month, tracker_id: trackerId ?? undefined }, { query: { gcTime: CACHE_GC_TIME } });
}

/** A week's sessions, newest first, a page at a time. Kept on the device. */
export function useWeekSessions(week: Week, trackerId: string | null) {
  const params = { from_date: week.from, to_date: week.to, tracker_id: trackerId ?? undefined, limit: WEEK_PAGE };
  const query = useInfiniteQuery({
    queryKey: [...getListSessionsQueryKey(params), 'pages'],
    queryFn: async ({ pageParam }) => {
      const answer = await listSessions({ ...params, cursor: pageParam ?? undefined });
      if (answer.status !== 200) {
        throw new Error('Unexpected response');
      }
      return answer.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    gcTime: CACHE_GC_TIME,
  });
  const items: SessionListItem[] | undefined = query.data?.pages.flatMap((page) => page.items);
  return { query, items };
}

/** Whether the account has any session at all, for History's empty state. */
export function useHasSessions(): boolean | undefined {
  const query = useListSessions({ limit: 1 }, { query: { gcTime: CACHE_GC_TIME } });
  if (query.data?.status !== 200) {
    return query.isError ? true : undefined;
  }
  return query.data.data.items.length > 0;
}

/** A session's title as History shows it, also in the breadcrumb: its name, its book, or its tracker. */
export function useSessionTitle(session: SessionOut | undefined): string {
  const trackers = useListTrackers({ include_archived: true }, { query: { enabled: Boolean(session) } });
  const books = useBooks();
  if (!session) {
    return '';
  }
  const tracker = trackers.data?.status === 200 ? trackers.data.data.items.find((item) => item.id === session.tracker_id) : undefined;
  const book = session.reading ? books.items?.find((item) => item.id === session.reading?.book_id) : undefined;
  return sessionTitle(session, tracker, book?.title);
}

function keepSession(client: QueryClient, session: SessionOut): void {
  client.setQueryData<getSessionResponse>(getGetSessionQueryKey(session.id), { status: 200, data: session, headers: new Headers() });
}

export type EditFailure = 'offline' | 'gone' | 'pagesBefore' | 'pagesLater' | 'future' | 'failed';

/**
 * Saves an edited session (PUT replaces it as a whole) and refreshes everything it feeds:
 * History, Home, goals and streaks. Edits need the server, so nothing waits on the device.
 */
export async function saveEditedSession(client: QueryClient, id: string, body: SessionWrite): Promise<EditFailure | null> {
  try {
    const answer = await putSession(id, body);
    if (answer.status === 200 || answer.status === 201) {
      keepSession(client, answer.data.session);
    }
    void refreshAccountData(client);
    return null;
  } catch (error) {
    return editFailure(error);
  }
}

function editFailure(error: unknown): EditFailure {
  if (!(error instanceof ApiError)) {
    return 'failed';
  }
  if (error.status === 0) {
    return 'offline';
  }
  if (error.status === 404) {
    return 'gone';
  }
  const field = error.fieldErrors[0];
  if (field?.code === 'not_after_previous') {
    return 'pagesBefore';
  }
  if (field?.code === 'conflicts_with_later') {
    return 'pagesLater';
  }
  return field?.code === 'in_future' ? 'future' : 'failed';
}

/**
 * Deletes a session at once (decision #14: no confirmation, Undo instead). A change of it still
 * waiting on the device goes too, so it cannot bring the session back.
 */
export async function removeSession(client: QueryClient, id: string): Promise<EditFailure | null> {
  try {
    await deleteSession(id);
  } catch (error) {
    const failure = editFailure(error);
    if (failure !== 'gone') {
      return failure;
    }
  }
  await removeItem(sessionKey(id));
  client.removeQueries({ queryKey: getGetSessionQueryKey(id), exact: true });
  void refreshAccountData(client);
  return null;
}

/** Undo: the session comes back, unless a later reading session of its book now conflicts with it. */
export async function restoreRemoved(client: QueryClient, id: string): Promise<'restored' | 'conflict' | 'failed'> {
  try {
    const answer = await restoreSession(id);
    if (answer.status === 200) {
      keepSession(client, answer.data);
    }
    void refreshAccountData(client);
    return 'restored';
  } catch (error) {
    return error instanceof ApiError && error.status === 409 ? 'conflict' : 'failed';
  }
}
