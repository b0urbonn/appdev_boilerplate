import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/components/FloatingTabBar';
import { SPRING, SPRING_BOUNCY } from '@/motion';
import { useTheme } from '@/theme';

const SIZE = 56;
const EDGE = 12;
const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

/** App-wide draggable shortcut to the chatbot. */
export function FloatingChatButton() {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const minY = insets.top + EDGE;
  const maxX = Math.max(EDGE, width - SIZE - EDGE);
  const maxY = Math.max(minY, height - insets.bottom - TAB_BAR_HEIGHT - TAB_BAR_GAP * 2 - SIZE - EDGE);
  const hidden = pathname.endsWith('/chat');

  const x = useSharedValue(maxX);
  const y = useSharedValue(clamp(Math.round(height * 0.5 - SIZE / 2), minY, maxY));
  const bounds = useSharedValue({ minY, maxX, maxY });
  const origin = useSharedValue({ x: 0, y: 0 });
  const lift = useSharedValue(1);
  const shown = useSharedValue(0);

  // Keep the button on screen after rotation or a window-size change.
  useEffect(() => {
    bounds.set({ minY, maxX, maxY });
    x.set(withSpring(clamp(x.get(), EDGE, maxX), SPRING));
    y.set(withSpring(clamp(y.get(), minY, maxY), SPRING));
  }, [bounds, maxX, maxY, minY, x, y]);

  // Pops in on launch and when leaving Chat; shrinks away while Chat is open.
  useEffect(() => {
    shown.set(hidden ? withTiming(0, { duration: 160 }) : withDelay(140, withSpring(1, SPRING_BOUNCY)));
  }, [hidden, shown]);

  const open = useCallback(() => router.push('/(tabs)/chat' as Href), [router]);

  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      origin.set({ x: x.get(), y: y.get() });
      lift.set(withSpring(1.08, SPRING));
    })
    .onUpdate((e) => {
      const b = bounds.get();
      x.set(clamp(origin.get().x + e.translationX, EDGE, b.maxX));
      y.set(clamp(origin.get().y + e.translationY, b.minY, b.maxY));
    })
    .onEnd((e) => {
      // Let a fling carry the button a little further before it settles.
      const b = bounds.get();
      x.set(withDecay({ velocity: e.velocityX, deceleration: 0.992, clamp: [EDGE, b.maxX] }));
      y.set(withDecay({ velocity: e.velocityY, deceleration: 0.992, clamp: [b.minY, b.maxY] }));
    })
    .onFinalize(() => {
      lift.set(withSpring(1, SPRING));
    });

  const tap = Gesture.Tap()
    .onBegin(() => {
      lift.set(withSpring(0.9, SPRING));
    })
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(open);
    })
    .onFinalize(() => {
      lift.set(withSpring(1, SPRING_BOUNCY));
    });

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.get()),
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: lift.get() * (0.3 + 0.7 * shown.get()) },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        pointerEvents={hidden ? 'none' : 'auto'}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={hidden}
        accessible={!hidden}
        accessibilityRole="button"
        accessibilityLabel="Open chatbot"
        accessibilityHint="Drag to move this button, or tap to open Chat"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') open();
        }}
        style={[
          styles.button,
          { backgroundColor: theme.buttonPrimary, borderColor: theme.background },
          style,
        ]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={25} color="#FFFFFF" />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 110,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
  },
});
