import type { QueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useAccountId } from '@/features/auth/account';
import { deliverBook, type Delivery, useOutbox } from '@/features/outbox/outbox';
import type { OutboxItem } from '@/features/outbox/rules';
import { CACHE_GC_TIME } from '@/shared/api/cache';
import { getListBooksQueryKey, useListBooks } from '@/shared/api/generated/endpoints/books/books';
import {
  getGetSessionQueryKey,
  getListSessionsQueryKey,
  type getSessionResponse,
  listSessions,
  useGetSession,
  useListSessions,
} from '@/shared/api/generated/endpoints/sessions/sessions';
import type { BookOut, BookWrite, SessionOut, SessionWrite } from '@/shared/api/generated/model';
import { newId } from '@/shared/ids';

type BooksAnswer = { status: 200; data: { items: BookOut[] }; headers: Headers };

/** A book that waits in the outbox, as the server will list it. */
export function waitingBook(id: string, body: BookWrite, now: string): BookOut {
  const start = body.start_page ?? 0;
  return {
    id,
    title: body.title,
    author: body.author ?? null,
    total_pages: body.total_pages,
    start_page: start,
    current_page: start,
    progress_percent: Math.floor((start / body.total_pages) * 100 + 0.5),
    finished_date: null,
    estimated_finish_date: null,
    created_at: now,
    updated_at: now,
  };
}

/** The server's books with the account's books still waiting in the outbox (newest first). */
export function withWaitingBooks(items: BookOut[], outbox: OutboxItem[], userId: string | undefined, now: string): BookOut[] {
  const waiting = outbox
    .filter((item) => item.kind === 'book' && item.userId === userId && item.failure === null)
    .map((item) => waitingBook(item.id, item.body as BookWrite, now));
  const waitingIds = new Set(waiting.map((book) => book.id));
  return [...waiting, ...items.filter((book) => !waitingIds.has(book.id))];
}

/**
 * The person's books, kept for the day and saved on the device; books added offline are listed
 * at once. The newest added or edited book comes first.
 */
export function useBooks() {
  const query = useListBooks(undefined, { query: { gcTime: CACHE_GC_TIME } });
  const accountId = useAccountId();
  const outbox = useOutbox((state) => state.items);
  const server = query.data?.status === 200 ? query.data.data.items : undefined;
  const items = useMemo(
    () => (server ? withWaitingBooks(server, outbox, accountId, new Date().toISOString()) : undefined),
    [server, outbox, accountId],
  );
  return { query, items };
}

/** Adds or edits a book through the outbox; the list on screen follows at once. */
export async function saveBook(
  client: QueryClient,
  userId: string,
  body: BookWrite,
  id: string = newId(),
): Promise<Delivery<BookOut> & { id: string }> {
  const result = await deliverBook(id, userId, body);
  if (result.status === 'saved') {
    client.setQueryData<BooksAnswer>(getListBooksQueryKey(), (answer) =>
      answer ? { ...answer, data: { items: [result.data, ...answer.data.items.filter((book) => book.id !== id)] } } : answer,
    );
    void client.invalidateQueries({ queryKey: getListBooksQueryKey() });
  }
  return { ...result, id };
}

/**
 * After a reading session is saved or queued, the saved book list shows the new current page,
 * so the next log starts from it even before the server answers.
 */
export function moveBookTo(client: QueryClient, body: SessionWrite): void {
  const reading = body.reading;
  if (!reading) {
    return;
  }
  client.setQueryData<BooksAnswer>(getListBooksQueryKey(), (answer) =>
    answer
      ? {
          ...answer,
          data: {
            items: answer.data.items.map((book) =>
              book.id === reading.book_id && reading.end_page > book.current_page
                ? {
                    ...book,
                    current_page: reading.end_page,
                    progress_percent: Math.floor((reading.end_page / book.total_pages) * 100 + 0.5),
                    finished_date: reading.end_page >= book.total_pages ? body.local_date : book.finished_date,
                  }
                : book,
            ),
          },
        }
      : answer,
  );
}

/**
 * The tracker's latest session, in full: what a quick log repeats. Kept on the device. Once it is
 * known for a tracker it stays as it was: a later answer never swaps the form under the person's
 * fingers (the form only reads it when it opens).
 */
export function useLastSession(trackerId: string | undefined) {
  const list = useListSessions(
    { tracker_id: trackerId ?? '', limit: 1 },
    { query: { enabled: Boolean(trackerId), gcTime: CACHE_GC_TIME } },
  );
  const lastId = list.data?.status === 200 ? list.data.data.items[0]?.id : undefined;
  const detail = useGetSession(lastId ?? '', { query: { enabled: Boolean(lastId), gcTime: CACHE_GC_TIME } });
  const known = list.data !== undefined || list.isError;
  const last = detail.data?.status === 200 ? detail.data.data : undefined;
  const ready = known && (!lastId || detail.data !== undefined || detail.isError);
  const [shown, setShown] = useState<{ trackerId: string | undefined; last: SessionOut | undefined } | null>(null);
  if (ready && shown?.trackerId !== trackerId) {
    setShown({ trackerId, last });
  }
  return shown && shown.trackerId === trackerId ? { ready: true, last: shown.last } : { ready, last };
}

/**
 * After a quick log is saved, the next one repeats it without waiting: the server's answer is
 * kept as that session, and the tracker's latest session is asked for again while Home is on show.
 */
export function rememberSaved(client: QueryClient, session: SessionOut): Promise<void> {
  client.setQueryData<getSessionResponse>(getGetSessionQueryKey(session.id), { status: 200, data: session, headers: new Headers() });
  const params = { tracker_id: session.tracker_id, limit: 1 };
  return client.prefetchQuery({
    queryKey: getListSessionsQueryKey(params),
    queryFn: () => listSessions(params),
    staleTime: 0,
    gcTime: CACHE_GC_TIME,
    retry: false,
  });
}
