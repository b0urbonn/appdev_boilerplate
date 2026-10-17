import React, { useEffect, useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SPRING_BOUNCY } from '@/motion';
import { useReduceMotion } from './AccessibilityPreferences';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a small spring scale for consistent tactile feedback. */
export function SmoothPressable({
  children,
  onPressIn,
  onPressOut,
  style,
  accessibilityRole = 'button',
  accessibilityState,
  disabled,
  hitSlop = 8,
  pressedScale = 0.96,
  ...props
}: PressableProps & { pressedScale?: number }) {
  const scale = useSharedValue(1);
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  useEffect(() => {
    if (disabled || reduceMotion) {
      cancelAnimation(scale);
      scale.set(1);
    }
  }, [disabled, reduceMotion, scale]);

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      onPressIn={(event) => {
        setPressed(true);
        if (!reduceMotion) scale.set(withTiming(pressedScale, { duration: 85 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        scale.set(reduceMotion ? 1 : withSpring(1, SPRING_BOUNCY));
        onPressOut?.(event);
      }}
      style={[resolvedStyle, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
