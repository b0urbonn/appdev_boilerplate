import React, { useEffect } from 'react';
import { StyleSheet, type SwitchProps } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SPRING } from '@/motion';
import { useTheme } from '@/theme';
import { useReduceMotion } from './AccessibilityPreferences';
import { SmoothPressable } from './SmoothPressable';

type Props = Pick<SwitchProps, 'value' | 'onValueChange' | 'disabled' | 'accessibilityLabel' | 'testID'> & {
  trackColor?: { false?: string; true?: string };
};

/** Controlled: the thumb moves only after the caller accepts the new value. */
export function AnimatedSwitch({ value = false, onValueChange, disabled, trackColor, accessibilityLabel, testID }: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(value ? 1 : 0);
  const offColor = trackColor?.false ?? theme.border;
  const onColor = trackColor?.true ?? theme.buttonPrimary;

  useEffect(() => {
    progress.set(reduceMotion ? Number(value) : withSpring(Number(value), { ...SPRING, overshootClamping: true }));
  }, [value, reduceMotion, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [offColor, onColor]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.get() * 20 }] }));

  return (
    <SmoothPressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      disabled={disabled}
      testID={testID}
      onPress={() => { if (!disabled) onValueChange?.(!value); }}
      pressedScale={0.94}
      style={[styles.target, { opacity: disabled ? 0.45 : 1 }]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  target: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  track: { width: 52, height: 32, borderRadius: 16 },
  thumb: {
    position: 'absolute', left: 3, top: 3, width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
});
