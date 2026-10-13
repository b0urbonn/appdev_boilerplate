import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '@/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 12;
const INACTIVE = '#8E8E93';
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
      color: focused ? theme.tint : INACTIVE,
      size,
    });

  const separate = state.routes.find((r) => r.name === SEPARATE_ROUTE);
  const separateFocused = state.routes[state.index]?.name === SEPARATE_ROUTE;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_GAP }]}
    >
      <View style={[styles.pill, surface(theme)]}>
        {state.routes
          .filter((r) => r.name !== SEPARATE_ROUTE)
          .map((route) => {
            const focused = state.routes[state.index]?.key === route.key;
            const { title } = descriptors[route.key].options;
            return (
              <Pressable
                key={route.key}
                onPress={() => go(route, focused)}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                style={styles.item}
              >
                {icon(route, focused, 25)}
                <Text style={[styles.label, { color: focused ? theme.tint : INACTIVE }]}>
                  {title ?? route.name}
                </Text>
              </Pressable>
            );
          })}
        {PLACEHOLDER_TABS.map((t, i) => (
          <View key={i} style={[styles.item, styles.placeholder]}>
            <Ionicons name={t.icon} size={25} color={INACTIVE} />
            <Text style={[styles.label, { color: INACTIVE }]}>{t.label}</Text>
          </View>
        ))}
      </View>
      {separate && (
        <Pressable
          onPress={() => go(separate, separateFocused)}
          accessibilityRole="tab"
          accessibilityLabel={descriptors[separate.key].options.title ?? separate.name}
          accessibilityState={{ selected: separateFocused }}
          style={[styles.circle, surface(theme)]}
        >
          {icon(separate, separateFocused, 27)}
        </Pressable>
      )}
    </View>
  );
}

const surface = (theme: Theme) => ({ backgroundColor: theme.card, borderColor: theme.border });

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
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  placeholder: { opacity: 0.5 },
  label: { fontSize: 10, fontWeight: '500' },
});

function shadow() {
  return {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  };
}
