import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { ScrollView, StyleSheet, useWindowDimensions, View, type ColorValue } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { FlowText as Text } from '@/components/FlowText';
import { TapPressable as Pressable } from '@/components/TapPressable';
import { localize } from '@/i18n';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const TUTORIAL_STEPS = [
  { route: '/' as Href, title: 'Your tasks and buttons', description: 'Date buttons choose a day. Add opens the form for a task’s name, date, time, category, priority, mood, and notes. Search, View all, status, and priority buttons help find tasks. Tap a task circle to complete it or the trash button to delete it.' },
  { route: '/calendar' as Href, title: 'Your calendar buttons', description: 'The menu chooses Year, Month, Week, Day, or Schedule. Search finds a task; Today returns to today; arrows change months and date buttons select a day. The sparkle button suggests a plan from your tasks. Add starts a task for the selected date.' },
  { route: '/weekly' as Href, title: 'Your progress buttons', description: 'Tap a day in the chart to see its completed tasks. Use the bottom tabs to return to Tasks or open Calendar and Settings.' },
  { route: '/preferences' as Href, title: 'Your settings buttons', description: 'Save stores your display name; Light and Dark change appearance; switches control preferences. Replay tutorial opens this guide again. Reset Sample Tasks replaces your list with examples. The profile button opens Settings.' },
];

/** Apple-style tab icon: filled when selected, outline when not. */
function tabIcon(filled: IconName, outline: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
  }
  return TabIcon;
}

export default function TabLayout() {
  const theme = useTheme();
  const { settings } = useSettings();
  const router = useRouter();
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialLoaded, setTutorialLoaded] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [neverAskAgain, setNeverAskAgain] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      Storage.getItem('flowtask.tutorial.done'),
      Storage.getItem('flowtask.tutorial.neverAsk'),
    ])
      .then(([done, neverAsk]) => {
        if (active && done !== 'true' && neverAsk !== 'true') setTutorialVisible(true);
      })
      .catch(error => console.warn('Unable to load tutorial preference:', error))
      .finally(() => { if (active) setTutorialLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('flowtask:replay-tutorial', () => {
      setTutorialStep(0);
      setNeverAskAgain(false);
      setTutorialVisible(true);
      setTutorialLoaded(true);
      router.navigate(TUTORIAL_STEPS[0].route);
      Promise.all([
        Storage.setItemAsync('flowtask.tutorial.done', 'false'),
        Storage.setItemAsync('flowtask.tutorial.neverAsk', 'false'),
      ]).catch(error => console.warn('Unable to reset tutorial preference:', error));
    });
    return () => subscription.remove();
  }, [router]);

  const dismissTutorial = async (completed: boolean) => {
    try {
      if (completed) await Storage.setItemAsync('flowtask.tutorial.done', 'true');
      if (neverAskAgain) await Storage.setItemAsync('flowtask.tutorial.neverAsk', 'true');
    } catch (error) {
      console.warn('Unable to save tutorial preference:', error);
    }
    setTutorialVisible(false);
  };
  const advanceTutorial = () => {
    if (tutorialStep === TUTORIAL_STEPS.length - 1) {
      void dismissTutorial(true);
      return;
    }
    const next = tutorialStep + 1;
    setTutorialStep(next);
    router.navigate(TUTORIAL_STEPS[next].route);
  };

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            backgroundColor: theme.background,
            paddingBottom: 82,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: localize(settings.language, 'Tasks', 'Mga gawain'), tabBarIcon: tabIcon('checkbox', 'checkbox-outline') }}
        />
        <Tabs.Screen
          name="calendar"
          options={{ title: localize(settings.language, 'Calendar', 'Kalendaryo'), tabBarIcon: tabIcon('calendar', 'calendar-outline') }}
        />
        <Tabs.Screen
          name="weekly"
          options={{ title: localize(settings.language, 'Progress', 'Pag-unlad'), tabBarIcon: tabIcon('bar-chart', 'bar-chart-outline') }}
        />
        <Tabs.Screen
          name="chat"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="preferences"
          options={{ title: localize(settings.language, 'Settings', 'Mga Setting'), tabBarIcon: tabIcon('settings', 'settings-outline') }}
        />
      </Tabs>
      {tutorialLoaded && tutorialVisible ? <TutorialOverlay
        step={tutorialStep}
        neverAskAgain={neverAskAgain}
        onNeverAskAgain={setNeverAskAgain}
        onNext={advanceTutorial}
        onSkip={() => void dismissTutorial(false)}
      /> : null}
    </View>
  );
}

function TutorialOverlay({ step, neverAskAgain, onNeverAskAgain, onNext, onSkip }: {
  step: number;
  neverAskAgain: boolean;
  onNeverAskAgain: (value: boolean) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const current = TUTORIAL_STEPS[step];
  const targetWidth = width / TUTORIAL_STEPS.length - 8;
  const targetLeft = step * width / TUTORIAL_STEPS.length + 4;
  const targetTop = height - Math.max(insets.bottom, 8) - 60;

  return <View style={styles.tutorialOverlay}>
    <View style={styles.tutorialDimmer} />
    <View style={[styles.tutorialHighlight, { left: targetLeft, top: targetTop, width: targetWidth, borderColor: theme.buttonPrimary }]} />
    <Ionicons name="arrow-down" size={22} color={theme.buttonPrimary} style={[styles.tutorialArrow, { left: targetLeft + targetWidth / 2 - 11, top: targetTop - 29 }]} />
    <View style={[styles.tutorialCard, { backgroundColor: theme.card, borderColor: theme.border, maxHeight: height - insets.top - insets.bottom - 150 }]}>
      <Text style={[styles.tutorialEyebrow, { color: theme.tint }]}>QUICK TOUR · {step + 1} OF {TUTORIAL_STEPS.length}</Text>
      <ScrollView style={styles.tutorialCopy} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
        <Text style={[styles.tutorialTitle, { color: theme.text }]}>{current.title}</Text>
        <Text style={[styles.tutorialDescription, { color: theme.textSecondary }]}>{current.description}</Text>
      </ScrollView>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: neverAskAgain }} onPress={() => onNeverAskAgain(!neverAskAgain)} style={styles.tutorialCheckbox}>
        <Ionicons name={neverAskAgain ? 'checkbox' : 'square-outline'} size={17} color={theme.tint} />
        <Text style={{ color: theme.textSecondary, fontSize: 10 }}>Never ask again</Text>
      </Pressable>
      <View style={styles.tutorialActions}>
        <Pressable accessibilityRole="button" onPress={onSkip} style={[styles.tutorialButton, { borderColor: theme.border }]}>
          <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '700' }}>Skip</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onNext} style={[styles.tutorialButton, { backgroundColor: theme.buttonPrimary }]}>
          <Text style={{ color: theme.text, fontSize: 10, fontWeight: '800' }}>{step === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tutorialOverlay: { ...StyleSheet.absoluteFill, zIndex: 20 },
  tutorialDimmer: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.56)' },
  tutorialHighlight: { position: 'absolute', height: 54, borderWidth: 2, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' },
  tutorialArrow: { position: 'absolute' },
  tutorialCard: { position: 'absolute', top: 76, left: 16, right: 16, padding: 14, borderWidth: 1, borderRadius: 16, gap: 7 },
  tutorialCopy: { flexShrink: 1 },
  tutorialEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  tutorialTitle: { fontSize: 15, fontWeight: '800' },
  tutorialDescription: { fontSize: 10, lineHeight: 16 },
  tutorialCheckbox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  tutorialActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 3 },
  tutorialButton: { minWidth: 74, minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderRadius: 10 },
});
