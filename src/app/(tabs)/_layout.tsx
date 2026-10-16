import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { FloatingTabBar, TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/components/FloatingTabBar';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Apple-style tab icon: filled when selected, outline when not. */
function tabIcon(filled: IconName, outline: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
  }
  return TabIcon;
}

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  return (
    <Tabs
      // Floating pill for Home, Scan, History and Learn. Chat is a global FAB.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Screens shift sideways a little when switching tabs.
        animation: reduceMotion ? 'none' : 'shift',
        // No header, so keep content below the status bar; leave room at the
        // bottom so the floating bar doesn't cover the screen's content.
        sceneStyle: {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + TAB_BAR_GAP * 2 + TAB_BAR_HEIGHT,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="scan"
        options={{ title: 'Scan', tabBarIcon: tabIcon('scan', 'scan-outline') }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: tabIcon('time', 'time-outline') }}
      />
      <Tabs.Screen
        name="learn"
        options={{ title: 'Learn', tabBarIcon: tabIcon('school', 'school-outline') }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          title: 'Chat',
          sceneStyle: { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom },
          tabBarIcon: tabIcon('chatbubble-ellipses', 'chatbubble-ellipses-outline'),
        }}
      />
    </Tabs>
  );
}
