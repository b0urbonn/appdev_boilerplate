import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href, type Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
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
import { isMonitorServiceEnabled, supportsAppMonitor } from '@/monitor/native';
import { EASE_OUT, pop, SPRING, SPRING_BOUNCY } from '@/motion';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 12;
const CHAT_ROUTE = 'chat';
const PROTECT_GREEN = '#178548';
const ITEM_INSET = 4;
const PROTECTION_SIZE = 78;
const CENTER_SLOT_WIDTH = 100;
type ProtectionState = 'protected' | 'paused' | 'setup';

/** Floating tab bar with a sliding selection pill and a center protection control. */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const { problem } = useAiStatus();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [serviceOn, setServiceOn] = useState(false);
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});

  useEffect(() => {
    if (!supportsAppMonitor) return;
    const syncService = () => setServiceOn(isMonitorServiceEnabled());
    syncService();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') syncService();
    });
    return () => sub.remove();
  }, []);

  const go = (route: (typeof state.routes)[number], focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  const focusedKey = state.routes[state.index]?.key;
  const chatFocused = state.routes[state.index]?.name === CHAT_ROUTE;
  const appCount = settings.monitoredApps.length;
  const protectionState: ProtectionState =
    !settings.monitoringEnabled ? 'paused'
    : serviceOn && appCount > 0 && !problem ? 'protected'
    : 'setup';
  const protectionColor =
    protectionState === 'protected' ? PROTECT_GREEN
    : protectionState === 'paused' ? theme.textSecondary
    : settings.theme === 'dark' ? theme.warning : '#D97706';
  const protectionLabel =
    protectionState === 'protected' ? 'Protected'
    : protectionState === 'paused' ? 'Paused'
    : 'Set up';
  const protectionIcon =
    protectionState === 'protected' ? 'shield-checkmark'
    : protectionState === 'paused' ? 'shield-outline'
    : 'shield-half-outline';
  const pillWidth = Math.max(1, screenWidth - 32);
  const notchRadius = PROTECTION_SIZE / 2 + 8;

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
        <Svg
          accessible={false}
          pointerEvents="none"
          width={pillWidth}
          height={TAB_BAR_HEIGHT}
          style={styles.pillShape}
        >
          <Path
            d={pillPath(pillWidth, TAB_BAR_HEIGHT, notchRadius)}
            fill={theme.card}
            stroke={theme.border}
            strokeWidth={StyleSheet.hairlineWidth}
          />
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: theme.buttonPrimary }, indicatorStyle]}
        />
        {state.routes.filter((route) => route.name !== CHAT_ROUTE).map((route) => {
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
                    onPress={() => router.push('/apps' as Href)}
                    pressedScale={0.92}
                    style={[styles.protectionSlot, { backgroundColor: protectionColor, borderColor: theme.card }]}
                  >
                    <PulseRing
                      color={protectionColor}
                      radius={PROTECTION_SIZE / 2}
                      active={protectionState !== 'paused'}
                      // Urgent pulse while setup is needed; slow heartbeat when protected.
                      period={protectionState === 'setup' ? 1400 : 2800}
                      maxScale={protectionState === 'setup' ? 1.22 : 1.12}
                    />
                    <Animated.View key={protectionIcon} entering={pop()}>
                      <Ionicons name={protectionIcon} size={25} color="#FFFFFF" />
                    </Animated.View>
                    <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={styles.protectionLabel}>
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
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pill: {
    position: 'relative',
    flex: 1,
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
    top: -PROTECTION_SIZE / 2,
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
  protectionLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', maxWidth: 70 },
  centerControls: {
    position: 'relative',
    width: CENTER_SLOT_WIDTH,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, marginVertical: ITEM_INSET },
  label: { fontSize: 11, fontWeight: '500' },
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

function pillPath(width: number, height: number, notchRadius: number): string {
  const corner = height / 2;
  const center = width / 2;
  const notch = Math.min(notchRadius, Math.max(24, center - corner));
  const k = 0.5522848;
  return [
    `M ${corner} 0`,
    `H ${center - notch}`,
    `C ${center - notch + notch * k} 0 ${center - notch * k} ${notch} ${center} ${notch}`,
    `C ${center + notch * k} ${notch} ${center + notch - notch * k} 0 ${center + notch} 0`,
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
