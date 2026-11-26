import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'compact' | 'medium' | 'expanded';

export const SIDEBAR_WIDTH = 224;
export const SIDE_COLUMN_WIDTH = 352;
export const CONTENT_MAX_WIDTH = 1136;

const PAGE_PADDING = 40;
const COLUMN_GAP = 24;
const MAIN_COLUMN_MIN = 480;

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
