import React, { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { EASE_OUT } from '@/motion';

/** Text that counts from its previous value to `value`. */
export function AnimatedNumber({
  value,
  format = String,
  style,
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(value, { duration, easing: EASE_OUT }));
  }, [duration, progress, value]);

  useAnimatedReaction(
    () => Math.round(progress.get()),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setDisplay, current);
    }
  );

  // Screen readers get the final value, not the in-between frames.
  return (
    <Text style={style} accessibilityLabel={format(value)}>
      {format(display)}
    </Text>
  );
}
