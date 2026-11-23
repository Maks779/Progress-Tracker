import { Platform } from 'react-native';

let keyboardInUse = false;

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', () => (keyboardInUse = true), true);
  document.addEventListener('pointerdown', () => (keyboardInUse = false), true);
}

/**
 * Whether a focused control should draw its focus ring: only while the keyboard is in use, as
 * the browser's `:focus-visible` does. A tap or click focuses a control too, but a ring then
 * is noise. Phones never report focus for taps.
 */
export function showFocusRing(focused: boolean | undefined): boolean {
  return Boolean(focused) && keyboardInUse;
}
