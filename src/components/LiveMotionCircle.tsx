import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useTheme } from '@/theme';

interface LiveMotionCircleProps {
  label?: string;
  subtitle?: string;
  selectedAppLabel?: string;
  onPress: () => void;
  active?: boolean;
}

export function LiveMotionCircle({
  label = 'Video Call Live Scan',
  subtitle = 'Real-time deepfake & defect detection during live calls',
  selectedAppLabel,
  onPress,
  active = true,
}: LiveMotionCircleProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const running = active && !reduceMotion;

  // Pulse ring 1 (larger, slower)
  const ring1 = useSharedValue(0);
  // Pulse ring 2 (medium, faster, staggered)
  const ring2 = useSharedValue(0);
  // Radar beam rotation (degrees)
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!running) {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(rotation);
      ring1.set(0);
      ring2.set(0);
      rotation.set(0);
      return;
    }

    ring1.set(0);
    ring1.set(
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );

    // Stagger ring 2 slightly
    ring2.set(0);
    ring2.set(
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );

    rotation.set(0);
    rotation.set(
      withRepeat(
        withTiming(360, { duration: 4000, easing: Easing.linear }),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(rotation);
    };
  }, [ring1, ring2, rotation, running]);

  const ringStyle1 = useAnimatedStyle(() => ({
    opacity: running ? 0.45 * (1 - ring1.get()) : 0,
    transform: [{ scale: 1 + 0.7 * ring1.get() }],
  }));

  const ringStyle2 = useAnimatedStyle(() => ({
    opacity: running ? 0.6 * (1 - ring2.get()) : 0,
    transform: [{ scale: 1 + 0.4 * ring2.get() }],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  const isDark = theme.text !== '#111111';

  return (
    <View style={styles.container}>
      <SmoothPressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${selectedAppLabel ? `Current target: ${selectedAppLabel}.` : ''} Tap to select an app or screen to detect defects live.`}
        accessibilityHint="Opens the app and screen selector for live monitoring"
        onPress={onPress}
        style={styles.pressable}
      >
        {/* Animated motion circle arena */}
        <View style={styles.motionArena}>
          {/* Outermost pulse ring */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                backgroundColor: theme.tint,
                borderColor: theme.tint,
              },
              ringStyle1,
            ]}
          />

          {/* Inner pulse ring */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                backgroundColor: theme.tint,
                borderColor: theme.tint,
              },
              ringStyle2,
            ]}
          />

          {/* Rotating radar sweep beam */}
          {running && (
            <Animated.View
              pointerEvents="none"
              style={[styles.radarSweepContainer, sweepStyle]}
            >
              <View
                style={[
                  styles.radarBeam,
                  {
                    backgroundColor: theme.tint,
                    opacity: isDark ? 0.28 : 0.2,
                  },
                ]}
              />
            </Animated.View>
          )}

          {/* Subtle radar concentric grid rings */}
          <View
            pointerEvents="none"
            style={[styles.radarGridRing, { borderColor: theme.border, opacity: 0.5 }]}
          />

          {/* Interactive center core */}
          <View
            style={[
              styles.centerCore,
              {
                backgroundColor: isDark ? '#161922' : '#FFFFFF',
                borderColor: isDark ? 'rgba(112, 183, 255, 0.4)' : 'rgba(0, 102, 204, 0.35)',
                shadowColor: theme.tint,
              },
            ]}
          >
            {/* Live badge pill on top of circle */}
            <View
              style={[
                styles.liveBadge,
                {
                  backgroundColor: isDark ? 'rgba(235, 75, 75, 0.22)' : 'rgba(235, 75, 75, 0.12)',
                  borderColor: theme.danger,
                },
              ]}
            >
              <View style={[styles.liveBeacon, { backgroundColor: theme.danger }]} />
              <Text style={[styles.liveBadgeText, { color: theme.danger }]}>LIVE</Text>
            </View>

            {/* Core Icon */}
            <Ionicons name="videocam" size={38} color={theme.tint} />

            {/* Sub-label inside core */}
            <Text style={[styles.coreActionText, { color: theme.textSecondary }]}>
              {selectedAppLabel ? 'Target: ' + selectedAppLabel : 'Tap to Select'}
            </Text>
          </View>
        </View>

        {/* Labels below the motion circle */}
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
      </SmoothPressable>
    </View>
  );
}

const ARENA_SIZE = 190;
const CORE_SIZE = 120;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
  },
  motionArena: {
    width: ARENA_SIZE,
    height: ARENA_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: CORE_SIZE,
    height: CORE_SIZE,
    borderRadius: CORE_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  radarSweepContainer: {
    position: 'absolute',
    width: ARENA_SIZE - 20,
    height: ARENA_SIZE - 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  radarBeam: {
    width: 2,
    height: (ARENA_SIZE - 20) / 2,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  radarGridRing: {
    position: 'absolute',
    width: ARENA_SIZE - 32,
    height: ARENA_SIZE - 32,
    borderRadius: (ARENA_SIZE - 32) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  centerCore: {
    width: CORE_SIZE,
    height: CORE_SIZE,
    borderRadius: CORE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  liveBeacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  coreActionText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  textBlock: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
});
