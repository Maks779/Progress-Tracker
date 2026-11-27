import { Easing, FadeIn, FadeInDown, ReduceMotion, SlideInDown } from 'react-native-reanimated';

const STEP_MS = 90;

/**
 * Ease-out (cubic) as a Bézier curve. Browsers run entering animations as CSS, which takes
 * only Bézier curves; `Easing.out(Easing.cubic)` would fall back to linear there.
 */
export function easeOut() {
  return Easing.bezier(0.33, 1, 0.68, 1);
}

/**
 * How a block enters a screen: it fades in and rises a little, one step after the block
 * above it. Ease-out, no bounce; with "reduce motion" on it simply appears.
 */
export function entrance(step: number) {
  return FadeInDown.duration(450)
    .delay(step * STEP_MS)
    .easing(easeOut())
    .reduceMotion(ReduceMotion.System);
}

/** A plain fade, e.g. the number inside a ring once the arc has filled. */
export function fadeIn(delayMs: number) {
  return FadeIn.duration(350).delay(delayMs).easing(easeOut()).reduceMotion(ReduceMotion.System);
}

const SHEET_MS = 200;

/** A sheet rises from the bottom edge on phones (motion spec: 200 ms, ease-out, no bounce). */
export function sheetEnter() {
  return SlideInDown.duration(SHEET_MS).easing(easeOut()).reduceMotion(ReduceMotion.System);
}

/** The same sheet as a centred dialog on wide screens, and the dimmed backdrop behind both. */
export function dialogEnter() {
  return FadeInDown.duration(SHEET_MS).easing(easeOut()).reduceMotion(ReduceMotion.System);
}

export function backdropEnter() {
  return FadeIn.duration(SHEET_MS).easing(easeOut()).reduceMotion(ReduceMotion.System);
}

const REVEAL_MS = 200;

/** A personal record badge appears on Summary (motion spec "PR reveal": 200 ms, ease-out), one after another. */
export function recordReveal(step: number) {
  return FadeInDown.duration(REVEAL_MS)
    .delay(300 + step * STEP_MS)
    .easing(easeOut())
    .reduceMotion(ReduceMotion.System);
}
