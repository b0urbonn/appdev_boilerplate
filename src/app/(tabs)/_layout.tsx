import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  return (
    <Tabs
      // Floating pill (Home + empty feature slots) with a separate Chat
      // button; see src/components/FloatingTabBar.tsx.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: tabIcon('chatbubble-ellipses', 'chatbubble-ellipses-outline'),
        }}
      />
    </Tabs>
  );
}
