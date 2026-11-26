import { type GestureResponderEvent, Platform } from 'react-native';

type Click = {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  button?: number;
  preventDefault?: () => void;
};

/**
 * Extra props that turn a pressable into a real link on the web: React Native Web renders it
 * as an anchor with this address, so it shows the address on hover and opens in a new tab with
 * a middle click or Ctrl / Cmd. Phones get nothing.
 */
export function linkProps(href: string): { href?: string } {
  return Platform.OS === 'web' ? { href } : {};
}

/**
 * Handles a press on such a link: a click with a modifier key or another mouse button is left
 * to the browser (new tab or window); any other press stops the browser's page load and runs
 * the in-app navigation instead.
 */
export function followLink(event: GestureResponderEvent, navigate: () => void) {
  if (Platform.OS === 'web') {
    const click = event as unknown as Click;
    if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey || (click.button ?? 0) !== 0) {
      return;
    }
    click.preventDefault?.();
  }
  navigate();
}

/** Marks the link to the page on screen: `aria-current` on the web, "selected" for phone screen readers. */
export function currentProps(current: boolean): { 'aria-selected'?: boolean } {
  if (Platform.OS === 'web') {
    return current ? ({ 'aria-current': 'page' } as object) : {};
  }
  return { 'aria-selected': current };
}
