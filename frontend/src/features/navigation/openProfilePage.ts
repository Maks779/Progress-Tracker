import { router } from 'expo-router';

import type { ProfilePage } from './trail';

/**
 * Opens a page of the Profile stack from anywhere, always with Profile under it: switches to
 * the Profile tab when another tab is showing, goes back to Profile (closing whatever was open
 * there, so the stack never grows), then opens the page. `showProfileTab` only switches tabs
 * and keeps the stack, like a tap on the tab; the router calls run after it, in order.
 */
export function openProfilePage(page: ProfilePage, pathname: string, showProfileTab: () => void) {
  if (pathname === page) {
    return;
  }
  if (pathname !== '/profile' && !pathname.startsWith('/profile/')) {
    showProfileTab();
  }
  router.dismissTo('/profile');
  if (page !== '/profile') {
    router.push(page, { withAnchor: true });
  }
}
