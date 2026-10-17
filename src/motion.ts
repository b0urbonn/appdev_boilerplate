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
import { Platform } from 'react-native';

export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** CSS `linear(0, 0.457 16.7%, 0.876 33.3%, 1.008 50%, 1.02 61.1%, 1)` — a
 *  piecewise-linear slight-overshoot spring, used by the tab-bar speed dial. */
export function easeOvershoot(t: number): number {
  'worklet';
  const p = [0, 0.167, 0.333, 0.5, 0.611, 1];
  const v = [0, 0.457, 0.876, 1.008, 1.02, 1];
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i]) {
      return v[i - 1] + ((t - p[i - 1]) / (p[i] - p[i - 1])) * (v[i] - v[i - 1]);
    }
  }
  return 1;
}

/** Snappy, no overshoot: indicators, toggles, presses. */
export const SPRING = { damping: 20, stiffness: 260, mass: 0.8 };
/** Slight overshoot for things that "arrive": bars, badges, icons. */
export const SPRING_BOUNCY = { damping: 13, stiffness: 180, mass: 0.9 };

const STAGGER_MS = 55;
const MAX_STAGGER = 10;

/** Fade + short rise. `index` staggers siblings; capped so long lists stay quick. */
export function enter(index = 0, baseDelay = 0) {
  if (Platform.OS === 'web') return undefined;
  return FadeInDown.duration(460)
    .easing(EASE_OUT)
    .delay(baseDelay + Math.min(index, MAX_STAGGER) * STAGGER_MS)
    .withInitialValues({ transform: [{ translateY: 14 }] });
}

/** Plain fade for content swaps where movement would be noisy. */
export function fadeIn(delay = 0) {
  if (Platform.OS === 'web') return undefined;
  return FadeIn.duration(260).easing(EASE_OUT).delay(delay);
}

export const exitFade = Platform.OS === 'web' ? undefined : FadeOut.duration(160);

/** Springy scale-in for badges, icons and small status marks. */
export function pop(delay = 0) {
  if (Platform.OS === 'web') return undefined;
  return ZoomIn.springify().damping(SPRING_BOUNCY.damping).stiffness(SPRING_BOUNCY.stiffness).delay(delay);
}

/** Siblings glide into place when something above them appears or leaves. */
export const layoutGlide =
  Platform.OS === 'web' ? undefined : LinearTransition.duration(280).easing(EASE_OUT);
