// Shared motion language: one easing curve, a couple of springs and the
// entering/exiting presets every screen uses. Reanimated skips these when the
// system "Remove animations" setting is on (ReduceMotion.System default).
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';

export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** Snappy, no overshoot: indicators, toggles, presses. */
export const SPRING = { damping: 20, stiffness: 260, mass: 0.8 };
/** Slight overshoot for things that "arrive": bars, badges, icons. */
export const SPRING_BOUNCY = { damping: 13, stiffness: 180, mass: 0.9 };

const STAGGER_MS = 55;
const MAX_STAGGER = 10;

/** Fade + short rise. `index` staggers siblings; capped so long lists stay quick. */
export function enter(index = 0, baseDelay = 0) {
  return FadeInDown.duration(460)
    .easing(EASE_OUT)
    .delay(baseDelay + Math.min(index, MAX_STAGGER) * STAGGER_MS)
    .withInitialValues({ transform: [{ translateY: 14 }] });
}

/** Plain fade for content swaps where movement would be noisy. */
export function fadeIn(delay = 0) {
  return FadeIn.duration(260).easing(EASE_OUT).delay(delay);
}

export const exitFade = FadeOut.duration(160);

/** Springy scale-in for badges, icons and small status marks. */
export function pop(delay = 0) {
  return ZoomIn.springify().damping(SPRING_BOUNCY.damping).stiffness(SPRING_BOUNCY.stiffness).delay(delay);
}

/** Siblings glide into place when something above them appears or leaves. */
export const layoutGlide = LinearTransition.duration(280).easing(EASE_OUT);
