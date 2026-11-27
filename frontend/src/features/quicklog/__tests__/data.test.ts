import { QueryClient } from '@tanstack/react-query';

import type { OutboxItem } from '@/features/outbox/rules';
import type { BookOut } from '@/shared/api/generated/model';

import { moveBookTo, waitingBook, withWaitingBooks } from '../data';

const NOW = '2026-11-27T10:00:00.000Z';

function book(id: string, current: number): BookOut {
  return { id, title: id, author: null, total_pages: 320, start_page: 0, current_page: current, progress_percent: 0, finished_date: null } as BookOut;
}

function waiting(id: string, userId: string, failure: OutboxItem['failure'] = null): OutboxItem {
  return { kind: 'book', id, userId, queuedAt: 1, revision: 'r', failure, body: { title: `Book ${id}`, total_pages: 200, start_page: 10 } };
}

describe('books on the device', () => {
  it('list books added offline first, only the account’s, without the refused ones', () => {
    expect(waitingBook('w', { title: 'W', total_pages: 200, start_page: 10 }, NOW)).toMatchObject({
      id: 'w',
      current_page: 10,
      progress_percent: 5,
      finished_date: null,
    });
    const items = withWaitingBooks([book('a', 100)], [waiting('w', 'me'), waiting('x', 'other'), waiting('y', 'me', 'refused')], 'me', NOW);
    expect(items.map((item) => item.id)).toEqual(['w', 'a']);
  });

  it('move a book to the page a reading session reached, finishing it on the last page', () => {
    const client = new QueryClient();
    client.setQueryData(['/api/v1/books'], { status: 200, data: { items: [book('a', 100), book('b', 300)] }, headers: new Headers() });
    moveBookTo(client, { tracker_id: 't', started_at: NOW, local_date: '2026-11-27', reading: { book_id: 'a', end_page: 160 } });
    moveBookTo(client, { tracker_id: 't', started_at: NOW, local_date: '2026-11-27', reading: { book_id: 'b', end_page: 320 } });
    moveBookTo(client, { tracker_id: 't', started_at: NOW, local_date: '2026-11-27', duration_s: 60 });
    const items = client.getQueryData<{ data: { items: BookOut[] } }>(['/api/v1/books'])!.data.items;
    expect(items[0]).toMatchObject({ current_page: 160, progress_percent: 50, finished_date: null });
    expect(items[1]).toMatchObject({ current_page: 320, progress_percent: 100, finished_date: '2026-11-27' });
    client.clear();
  });
});
