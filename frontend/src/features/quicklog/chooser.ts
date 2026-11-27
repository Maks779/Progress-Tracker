import { create } from 'zustand';

/** Switches to a tab by its route name, from wherever the sheet was opened. */
export type ShowTab = (tab: '(home)' | 'profile') => void;

type ChooserState = { open: boolean; showTab: ShowTab | null };

/**
 * "Log a session", the sheet behind the "+" tab and Home's "Other": one sheet for the whole
 * app. The quick log and the workout open over Home; creating a tracker opens in Profile.
 */
export const useChooser = create<ChooserState>()(() => ({ open: false, showTab: null }));

export function openChooser(showTab: ShowTab): void {
  useChooser.setState({ open: true, showTab });
}

export function closeChooser(): void {
  useChooser.setState({ open: false, showTab: null });
}
