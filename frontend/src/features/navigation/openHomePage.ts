import { router } from 'expo-router';

/** A page of the Home stack that other places open: the workout from the sidebar or Trackers. */
export type HomePage = '/workout';

function inHome(pathname: string): boolean {
  return pathname === '/' || pathname === '/workout' || pathname.startsWith('/workout/');
}

/**
 * Opens a page of the Home stack from anywhere, always with Home under it: switches to the
 * Home tab when another tab is showing, goes back to Home, then opens the page. Like
 * `openProfilePage`, `showHomeTab` only switches tabs; the router calls run after it, in order.
 */
export function openHomePage(page: HomePage, pathname: string, showHomeTab: () => void) {
  if (pathname === page) {
    return;
  }
  if (!inHome(pathname)) {
    showHomeTab();
  }
  router.dismissTo('/');
  router.push(page, { withAnchor: true });
}
