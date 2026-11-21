import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'compact' | 'medium' | 'expanded';

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
