import React, { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from './AccessibilityPreferences';

/**
 * An expanding, fading ring drawn behind a round element to signal live
 * status. Place inside a relatively positioned parent of the same size.
 */
export function PulseRing({
  color,
  active = true,
  period = 1800,
  maxScale = 1.45,
  radius,
  style,
}: {
  color: string;
  active?: boolean;
  period?: number;
  maxScale?: number;
  radius: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const t = useSharedValue(0);
  const running = active && !reduceMotion;

  useEffect(() => {
    if (!running) {
      cancelAnimation(t);
      t.set(0);
      return;
    }
    t.set(0);
    t.set(withRepeat(withTiming(1, { duration: period, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [period, running, t]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: running ? 0.55 * (1 - t.get()) : 0,
    transform: [{ scale: 1 + (maxScale - 1) * t.get() }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: color }, ringStyle, style]}
    />
  );
}
