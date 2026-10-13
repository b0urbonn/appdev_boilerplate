import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useTheme } from '@/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 12;
/** This route gets its own round button next to the pill. */
const SEPARATE_ROUTE = 'chat';

/**
 * Empty tab slots for features you haven't built yet. To make one real:
 * create `src/app/(tabs)/<name>.tsx`, add a <Tabs.Screen> for it in
 * `src/app/(tabs)/_layout.tsx`, then remove its entry here.
 */
const PLACEHOLDER_TABS: { label: string; icon: IconName }[] = [
  { label: 'Feature', icon: 'add-circle-outline' },
  { label: 'Feature', icon: 'add-circle-outline' },
  { label: 'Feature', icon: 'add-circle-outline' },
];

/** Floating pill tab bar with a separate round Chat button (Apple-style). */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const go = (route: (typeof state.routes)[number], focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };
  const icon = (route: (typeof state.routes)[number], focused: boolean, size: number) =>
    descriptors[route.key].options.tabBarIcon?.({
      focused,
      color: focused ? '#FFFFFF' : theme.textSecondary,
      size,
    });

  const separate = state.routes.find((r) => r.name === SEPARATE_ROUTE);
  const separateFocused = state.routes[state.index]?.name === SEPARATE_ROUTE;

  if (separateFocused) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_GAP }]}
    >
      <View style={[styles.pill, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {state.routes
          .filter((r) => r.name !== SEPARATE_ROUTE)
          .map((route) => {
            const focused = state.routes[state.index]?.key === route.key;
            const { title } = descriptors[route.key].options;
            return (
              <SmoothPressable
                key={route.key}
                onPress={() => go(route, focused)}
                accessibilityLabel={title ?? route.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                style={[styles.item, focused ? { backgroundColor: theme.buttonPrimary, borderRadius: TAB_BAR_HEIGHT / 2 } : undefined]}
              >
                {icon(route, focused, 25)}
                <Text style={[styles.label, { color: focused ? '#FFFFFF' : theme.textSecondary }]}>
                  {title ?? route.name}
                </Text>
              </SmoothPressable>
            );
          })}
        {PLACEHOLDER_TABS.map((t, i) => (
          <View key={i} accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.item, styles.placeholder]}>
            <Ionicons name={t.icon} size={25} color={theme.textSecondary} />
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t.label}</Text>
          </View>
        ))}
      </View>
      {separate && (
        <SmoothPressable
          onPress={() => go(separate, separateFocused)}
          accessibilityRole="tab"
          accessibilityLabel={descriptors[separate.key].options.title ?? separate.name}
          accessibilityState={{ selected: separateFocused }}
          style={[styles.circle, { backgroundColor: separateFocused ? theme.buttonPrimary : theme.card, borderColor: separateFocused ? theme.buttonPrimary : theme.border }]}
        >
          {icon(separate, separateFocused, 27)}
        </SmoothPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow(),
  },
  circle: {
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow(),
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, marginVertical: 4 },
  placeholder: { opacity: 1 },
  label: { fontSize: 12, fontWeight: '500' },
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
