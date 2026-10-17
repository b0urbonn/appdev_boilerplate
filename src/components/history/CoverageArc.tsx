import React, { useEffect } from 'react';
import { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export interface CoverageArcProps { radius: number; color: string; value: number; goal: number; reduceMotion: boolean }

/** Native SVG uses circumference units, equivalent to the web's pathLength=1. */
export function CoverageArc({ radius, color, value, goal, reduceMotion }: CoverageArcProps) {
  const fraction = useSharedValue(0);
  const circumference = 2 * Math.PI * radius;
  useEffect(() => {
    fraction.set(withTiming(Math.max(0, Math.min(1, value / goal)), {
      duration: reduceMotion ? 80 : 1100,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    }));
  }, [fraction, goal, reduceMotion, value]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fraction.get()),
    // A zero-length round cap would otherwise look like nonzero activity.
    strokeOpacity: fraction.get() > 0 ? 1 : 0,
  }));
  return <AnimatedCircle cx={80} cy={80} r={radius} stroke={color} strokeWidth={15} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} transform="rotate(-90 80 80)" animatedProps={animatedProps} />;
}
