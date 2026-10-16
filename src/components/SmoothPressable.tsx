import React, { useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SPRING } from '@/motion';

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
  pressedScale = 0.97,
  ...props
}: PressableProps & { pressedScale?: number }) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      onPressIn={(event) => {
        setPressed(true);
        scale.set(withSpring(pressedScale, SPRING));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        scale.set(withSpring(1, SPRING));
        onPressOut?.(event);
      }}
      style={[resolvedStyle, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
