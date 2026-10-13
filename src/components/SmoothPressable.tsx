import React, { useState } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
} from 'react-native';
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
  ...props
}: PressableProps) {
  const reduceMotion = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);
  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;

  const animate = (toValue: number) => {
    if (reduceMotion) { scale.setValue(1); return; }
    Animated.spring(scale, {
      toValue,
      speed: 38,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      onPressIn={(event) => {
        setPressed(true);
        animate(0.985);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        animate(1);
        onPressOut?.(event);
      }}
      style={[resolvedStyle, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
