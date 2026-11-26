import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'compact' | 'medium' | 'expanded';

export const SIDEBAR_WIDTH = 224;
export const SIDE_COLUMN_WIDTH = 352;
export const TABLET_SIDE_COLUMN_WIDTH = 264;
export const CONTENT_MAX_WIDTH = 1136;

const PAGE_PADDING = 40;
const COLUMN_GAP = 24;
const MAIN_COLUMN_MIN = 480;
const TABLET_MAIN_COLUMN_MIN = 360;

/** compact < 600 px (phones), medium 600–1023 px (tablets), expanded ≥ 1024 px (desktop). */
export function breakpointFor(width: number): Breakpoint {
  if (width >= 1024) {
    return 'expanded';
  }
  if (width >= 600) {
    return 'medium';
  }
  return 'compact';
}

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return breakpointFor(width);
}

/**
 * Whether a page has room for its supporting column beside the main one: next to the
 * sidebar, the main column must keep at least 480 px, which needs a window of 1160 px
 * (224 + 2 × 40 + 480 + 24 + 352). Narrower desktop windows stack the two, like tablets.
 */
export function hasTwoColumns(width: number): boolean {
  return width >= SIDEBAR_WIDTH + 2 * PAGE_PADDING + MAIN_COLUMN_MIN + COLUMN_GAP + SIDE_COLUMN_WIDTH;
}

export function useTwoColumns(): boolean {
  const { width } = useWindowDimensions();
  return hasTwoColumns(width);
}

/**
 * The width of a page's supporting column, or null when it goes below the main content. Every
 * page gets the 352 px column where `hasTwoColumns` allows it. Pages that keep it on tablets
 * too (Home, History, Progress) otherwise get the tablet design's 264 px column, as long as the
 * main column keeps 360 px: from a 728 px tablet, and on every desktop window.
 */
export function sideColumnFor(width: number, onTablets: boolean): number | null {
  if (hasTwoColumns(width)) {
    return SIDE_COLUMN_WIDTH;
  }
  const breakpoint = breakpointFor(width);
  if (!onTablets || breakpoint === 'compact') {
    return null;
  }
  const page = width - (breakpoint === 'expanded' ? SIDEBAR_WIDTH : 0) - 2 * PAGE_PADDING;
  const main = Math.min(page, CONTENT_MAX_WIDTH) - COLUMN_GAP - TABLET_SIDE_COLUMN_WIDTH;
  return main >= TABLET_MAIN_COLUMN_MIN ? TABLET_SIDE_COLUMN_WIDTH : null;
}

export function useSideColumn(onTablets: boolean): number | null {
  const { width } = useWindowDimensions();
  return sideColumnFor(width, onTablets);
}
