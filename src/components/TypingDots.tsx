import { useReduceMotion } from './AccessibilityPreferences';
import React, { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

/** Three pulsing dots shown while the assistant is thinking. */
export function TypingDots({ color }: { color: string }) {
  const [dots] = useState(() =>
    [0, 1, 2].map(() => new Animated.Value(0.3))
  );
  const reduceMotion = useReduceMotion();
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (reduceMotion) { dots.forEach((dot) => dot.setValue(0.7)); return; }
    const loop = Animated.loop(
      Animated.stagger(
        160,
        dots.map((v) =>
          Animated.sequence([
            Animated.timing(v, {
              toValue: 1,
              duration: 300,
              useNativeDriver: native,
            }),
            Animated.timing(v, {
              toValue: 0.3,
              duration: 300,
              useNativeDriver: native,
            }),
          ])
        )
      )
    );
    loop.start();
    return () => loop.stop();
  }, [dots, native, reduceMotion]);

  return (
    <View style={styles.row}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { backgroundColor: color, opacity: v }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
