import { router } from 'expo-router';

/** A page of the History stack that other places open: the month, or a session. */
export type HistoryPage = '/history' | `/history/${string}`;

/**
 * Opens a page of the History stack from anywhere, always with the month under it: switches
 * to the History tab when another tab is showing, goes back to the month, then opens the page.
 * Like `openProfilePage`, `showHistoryTab` only switches tabs; the router calls run after it.
 */
export function openHistoryPage(page: HistoryPage, pathname: string, showHistoryTab: () => void) {
  if (pathname === page) {
    return;
  }
  if (pathname !== '/history' && !pathname.startsWith('/history/')) {
    showHistoryTab();
  }
  router.dismissTo('/history');
  if (page !== '/history') {
    router.push(page, { withAnchor: true });
  }
}
