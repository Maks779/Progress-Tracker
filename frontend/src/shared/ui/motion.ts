import { Easing, FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

const STEP_MS = 90;

/**
 * How a block enters a screen: it fades in and rises a little, one step after the block
 * above it. Ease-out, no bounce; with "reduce motion" on it simply appears.
 */
export function entrance(step: number) {
  return FadeInDown.duration(450)
    .delay(step * STEP_MS)
    .easing(Easing.out(Easing.cubic))
    .reduceMotion(ReduceMotion.System);
}

/** A plain fade, e.g. the number inside a ring once the arc has filled. */
export function fadeIn(delayMs: number) {
  return FadeIn.duration(350).delay(delayMs).reduceMotion(ReduceMotion.System);
}
