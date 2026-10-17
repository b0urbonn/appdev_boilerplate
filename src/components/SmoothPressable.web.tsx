import React, { useState } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import { useReduceMotion } from './AccessibilityPreferences';

type WebMotionStyle = ViewStyle & {
  transitionProperty: string;
  transitionDuration: string;
  transitionTimingFunction: string;
};

/** Browser transitions keep button feedback on the compositor instead of a JS frame loop. */
export function SmoothPressable({
  children,
  style,
  disabled,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop = 8,
  pressedScale = 0.96,
  onHoverIn,
  onHoverOut,
  ...props
}: PressableProps & { pressedScale?: number }) {
  const reduceMotion = useReduceMotion();
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      {...props}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      onHoverIn={(event) => { setHovered(true); onHoverIn?.(event); }}
      onHoverOut={(event) => { setHovered(false); onHoverOut?.(event); }}
      style={(state) => {
        const animate = !disabled && !reduceMotion;
        const motion: WebMotionStyle = {
          transform: [
            { translateY: animate && hovered && !state.pressed ? -1 : 0 },
            { scale: animate ? state.pressed ? pressedScale : hovered ? 1.01 : 1 : 1 },
          ],
          transitionProperty: 'transform, background-color, border-color, opacity, box-shadow',
          transitionDuration: reduceMotion ? '0ms' : state.pressed ? '85ms' : '180ms',
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        };
        return [typeof style === 'function' ? style(state) : style, motion];
      }}
    >
      {children}
    </Pressable>
  );
}
