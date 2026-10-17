import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href, type Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PulseRing } from '@/components/PulseRing';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useAiStatus } from '@/hooks/useAiStatus';
import { useMonitorService } from '@/monitor/useMonitorService';
import { EASE_OUT, pop, SPRING, SPRING_BOUNCY } from '@/motion';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 12;
const CHAT_ROUTE = 'chat';
const PROTECT_GREEN = '#178548';
const ITEM_INSET = 4;
const PROTECTION_SIZE = 76;
const CENTER_SLOT_WIDTH = 100;
// How far below the bar's top edge the circle sits, and the channel gap
// between the circle and the notch edge — the notch is cut concentric with
// the button so the cut wraps around it.
const NOTCH_SEAT = 10;
const NOTCH_GAP = 6;
type ProtectionState = 'protected' | 'paused' | 'setup';

/** Floating tab bar with a sliding selection pill and a center protection button. */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const { problem } = useAiStatus();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { enabled: serviceOn, connected } = useMonitorService();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});

  const go = (route: (typeof state.routes)[number], focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  const focusedKey = state.routes[state.index]?.key;
  const chatFocused = state.routes[state.index]?.name === CHAT_ROUTE;
  const appCount = settings.monitoredApps.length;
  const protectionState: ProtectionState =
    !settings.monitoringEnabled ? 'paused'
    : serviceOn && connected && appCount > 0 && !problem ? 'protected'
    : 'setup';
  const protectionColor =
    protectionState === 'protected' ? PROTECT_GREEN
    : protectionState === 'paused' ? theme.textSecondary
    : settings.theme === 'dark' ? theme.warning : '#D97706';
  const protectionLabel =
    protectionState === 'protected' ? 'Protected'
    : protectionState === 'paused' ? 'Paused'
    : !serviceOn ? 'Enable'
    : !connected ? 'Reconnect'
    : appCount === 0 ? 'Choose apps'
    : 'Set up';
  const protectionIcon =
    protectionState === 'protected' ? 'shield-checkmark'
    : protectionState === 'paused' ? 'shield-outline'
    : 'shield-half-outline';
  const pillWidth = Math.min(560, Math.max(1, screenWidth - 32));
  const notchRadius = PROTECTION_SIZE / 2 + NOTCH_GAP;

  // Selection pill glides between tabs once their positions are known.
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const indicatorPlaced = useSharedValue(false);
  const target = focusedKey ? layouts[focusedKey] : undefined;
  useEffect(() => {
    if (!target) return;
    if (!indicatorPlaced.get()) {
      indicatorX.set(target.x);
      indicatorW.set(target.width);
      indicatorPlaced.set(true);
    } else {
      indicatorX.set(withSpring(target.x, SPRING));
      indicatorW.set(withSpring(target.width, SPRING));
    }
  }, [indicatorPlaced, indicatorW, indicatorX, target]);
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorPlaced.get() ? 1 : 0,
    width: indicatorW.get(),
    transform: [{ translateX: indicatorX.get() }],
  }));

  // Slide the whole bar away while Chat is open instead of popping it out.
  const hiddenOffset = TAB_BAR_HEIGHT + TAB_BAR_GAP + insets.bottom + 16;
  const visibility = useSharedValue(chatFocused ? 0 : 1);
  useEffect(() => {
    visibility.set(chatFocused ? withTiming(0, { duration: 180, easing: EASE_OUT }) : withSpring(1, SPRING));
  }, [chatFocused, visibility]);
  const wrapStyle = useAnimatedStyle(() => ({
    opacity: visibility.get(),
    transform: [{ translateY: (1 - visibility.get()) * hiddenOffset }],
  }));

  const onItemLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) =>
      prev[key]?.x === x && prev[key]?.width === width ? prev : { ...prev, [key]: { x, width } }
    );
  };

  return (
    <Animated.View
      pointerEvents={chatFocused ? 'none' : 'box-none'}
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_GAP }, wrapStyle]}
    >
      <View style={styles.pill}>
        {Platform.OS === 'web' ? (
          <svg
            width={pillWidth}
            height={TAB_BAR_HEIGHT}
            style={{ position: 'absolute', top: 0, left: 0, display: 'block', pointerEvents: 'none' }}
          >
            <path
              d={pillPath(pillWidth, TAB_BAR_HEIGHT, notchRadius, NOTCH_SEAT)}
              fill={theme.card}
              stroke={theme.border}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          </svg>
        ) : (
          <Svg
            accessible={false}
            pointerEvents="none"
            width={pillWidth}
            height={TAB_BAR_HEIGHT}
            style={styles.pillShape}
          >
            <Path
              d={pillPath(pillWidth, TAB_BAR_HEIGHT, notchRadius, NOTCH_SEAT)}
              fill={theme.card}
              stroke={theme.border}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          </Svg>
        )}
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: theme.buttonPrimary }, indicatorStyle]}
        />
        {state.routes
          .filter((route) => route.name !== CHAT_ROUTE)
          .map((route) => {
            const focused = focusedKey === route.key;
            const { title, tabBarIcon } = descriptors[route.key].options;
            return (
              <React.Fragment key={route.key}>
                <TabItem
                  label={title ?? route.name}
                  focused={focused}
                  onPress={() => go(route, focused)}
                  onLayout={onItemLayout(route.key)}
                  renderIcon={(color) => tabBarIcon?.({ focused, color, size: 25 })}
                  inactiveColor={theme.textSecondary}
                />
                {route.name === 'scan' && (
                  <View style={styles.centerControls}>
                    <SmoothPressable
                      accessibilityRole="button"
                      accessibilityLabel={`Protection: ${protectionLabel}. Open protected apps`}
                      accessibilityHint="Navigates directly to protection settings"
                      onPress={() => router.push('/apps' as Href)}
                      pressedScale={0.92}
                      style={[styles.protectionSlot, { backgroundColor: protectionColor, borderColor: theme.card }]}
                    >
                      <PulseRing
                        color={protectionColor}
                        radius={PROTECTION_SIZE / 2}
                        active={protectionState !== 'paused'}
                        period={protectionState === 'setup' ? 1400 : 2800}
                        maxScale={protectionState === 'setup' ? 1.22 : 1.12}
                      />
                      <Animated.View key={protectionIcon} entering={pop()}>
                        <Ionicons name={protectionIcon} size={25} color="#FFFFFF" />
                      </Animated.View>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        maxFontSizeMultiplier={1.2}
                        style={styles.protectionLabel}
                      >
                        {protectionLabel}
                      </Text>
                    </SmoothPressable>
                  </View>
                )}
              </React.Fragment>
            );
          })}
      </View>
    </Animated.View>
  );
}

function TabItem({
  label,
  focused,
  onPress,
  onLayout,
  renderIcon,
  inactiveColor,
}: {
  label: string;
  focused: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
  renderIcon: (color: string) => React.ReactNode;
  inactiveColor: string;
}) {
  const iconScale = useSharedValue(1);

  // A little hop when the tab becomes selected.
  useEffect(() => {
    if (focused) iconScale.set(withSequence(withSpring(1.18, SPRING), withSpring(1, SPRING_BOUNCY)));
  }, [focused, iconScale]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.get() }] }));
  const color = focused ? '#FFFFFF' : inactiveColor;

  return (
    <SmoothPressable
      onPress={onPress}
      onLayout={onLayout}
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      pressedScale={0.94}
      style={styles.item}
    >
      <Animated.View style={iconStyle}>{renderIcon(color)}</Animated.View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.3}
        style={[styles.label, { color }]}
      >
        {label}
      </Text>
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 100,
  },
  pill: {
    position: 'relative',
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 6,
    overflow: 'visible',
  },
  pillShape: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: ITEM_INSET,
    bottom: ITEM_INSET,
    borderRadius: TAB_BAR_HEIGHT / 2,
  },
  protectionSlot: {
    position: 'absolute',
    top: NOTCH_SEAT - PROTECTION_SIZE / 2,
    left: (CENTER_SLOT_WIDTH - PROTECTION_SIZE) / 2,
    width: PROTECTION_SIZE,
    flexShrink: 0,
    height: PROTECTION_SIZE,
    borderRadius: PROTECTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderWidth: 2,
    ...shadow(),
  },
  protectionLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 70,
  },
  centerControls: {
    position: 'relative',
    width: CENTER_SLOT_WIDTH,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginVertical: ITEM_INSET,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});

function shadow() {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  };
}

function pillPath(width: number, height: number, notchRadius: number, seat: number): string {
  const corner = height / 2;
  const center = width / 2;
  const notch = Math.min(notchRadius, Math.max(24, center - corner));
  // The arc is concentric with the button (whose center is `seat` below the
  // top edge), so it sweeps past the button's widest point and the cut hugs
  // the circle instead of ending in a shallow dip under it.
  const half = Math.sqrt(Math.max(1, notch * notch - seat * seat));
  const entry = Math.asin(Math.min(1, seat / notch));
  return [
    `M ${corner} 0`,
    `H ${center - half}`,
    ...arcCommands(center, seat, notch, Math.PI + entry, -entry),
    `H ${width - corner}`,
    `Q ${width} 0 ${width} ${corner}`,
    `V ${height - corner}`,
    `Q ${width} ${height} ${width - corner} ${height}`,
    `H ${corner}`,
    `Q 0 ${height} 0 ${height - corner}`,
    `V ${corner}`,
    `Q 0 0 ${corner} 0 Z`,
  ].join(' ');
}

/** `C` segments approximating a circular arc from angle `a0` to `a1` (radians). */
function arcCommands(cx: number, cy: number, r: number, a0: number, a1: number): string[] {
  const round = (n: number) => Math.round(n * 100) / 100;
  const segments = 8;
  const step = (a1 - a0) / segments;
  const k = (4 / 3) * Math.tan(step / 4);
  const cmds: string[] = [];
  for (let i = 0; i < segments; i++) {
    const t0 = a0 + step * i;
    const t1 = t0 + step;
    const p1x = cx + r * (Math.cos(t0) - k * Math.sin(t0));
    const p1y = cy + r * (Math.sin(t0) + k * Math.cos(t0));
    const p2x = cx + r * (Math.cos(t1) + k * Math.sin(t1));
    const p2y = cy + r * (Math.sin(t1) - k * Math.cos(t1));
    const p3x = cx + r * Math.cos(t1);
    const p3y = cy + r * Math.sin(t1);
    cmds.push(`C ${round(p1x)} ${round(p1y)} ${round(p2x)} ${round(p2y)} ${round(p3x)} ${round(p3y)}`);
  }
  return cmds;
}
