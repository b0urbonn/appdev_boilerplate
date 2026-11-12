import type { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SmoothPressable } from '@/components/SmoothPressable';
import { FlowText as Text } from '@/components/FlowText';
import { useTheme } from '@/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_GAP = 12;

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.card, borderColor: theme.border }]}>
      {state.routes.map((route, index) => {
        if (route.name === 'chat') return null;
        const focused = state.index === index;
        const { title } = descriptors[route.key].options;
        const icon = descriptors[route.key].options.tabBarIcon?.({
          focused,
          color: focused ? theme.tint : theme.textSecondary,
          size: 20,
        });
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <SmoothPressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={title ?? route.name}
            accessibilityState={{ selected: focused }}
            style={[styles.item, focused && { backgroundColor: theme.buttonSecondary }]}
          >
            {icon}
            <Text style={[styles.label, { color: focused ? theme.tint : theme.textSecondary }]}>{title ?? route.name}</Text>
          </SmoothPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  item: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginHorizontal: 2,
    borderRadius: 12,
  },
  label: { fontSize: 10, fontWeight: '700' },
});
