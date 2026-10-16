import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, type AppStateStatus, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppLockScreen } from '@/components/AppLockScreen';
import { getDb } from '@/db/client';
import { refreshModelStatus } from '@/ai/local';
import { DownloadStatusIndicator } from '@/components/DownloadStatusIndicator';
import { FloatingChatButton } from '@/components/FloatingChatButton';
import { PopupProvider } from '@/components/Popup';
import { AccessibilityPreferences, useReduceMotion } from '@/components/AccessibilityPreferences';
import { useMonitorSync } from '@/monitor/useMonitorSync';
import { SettingsProvider, useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Open + migrate the database and read the local model's on-disk
    // state before rendering any screen.
    Promise.all([getDb(), refreshModelStatus()])
      .catch((e) => console.warn('Init failed:', e))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SettingsProvider>
        <AccessibilityPreferences><PopupProvider><RootNavigator /></PopupProvider></AccessibilityPreferences>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

/** Shows onboarding until it's completed, then the main app. */
function RootNavigator() {
  const theme = useTheme();
  const { settings, ready } = useSettings();
  const reduceMotion = useReduceMotion();
  const [isLocked, setIsLocked] = useState(false);
  const [lockReady, setLockReady] = useState(false);
  const lockInitialized = useRef(false);
  const lastBackgroundTime = useRef<number | null>(null);
  useMonitorSync();

  // A cold launch starts locked when app lock is enabled. Keep the loading
  // view up until this decision is made so protected screens never flash first.
  useEffect(() => {
    if (!ready || lockInitialized.current) return;
    lockInitialized.current = true;
    setIsLocked(settings.onboarded && settings.appLockEnabled);
    setLockReady(true);
  }, [ready, settings.appLockEnabled, settings.onboarded]);

  // Lock again when the app returns from the background after the selected delay.
  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        lastBackgroundTime.current = Date.now();
      } else if (nextAppState === 'active') {
        const backgroundTime = lastBackgroundTime.current;
        lastBackgroundTime.current = null;
        if (settings.appLockEnabled && backgroundTime !== null) {
          const elapsed = Date.now() - backgroundTime;
          const timeoutMs =
            settings.appLockTimeout === '1m'
              ? 60 * 1000
              : settings.appLockTimeout === '5m'
              ? 5 * 60 * 1000
              : 0; // 'immediate'
          if (elapsed >= timeoutMs) {
            setIsLocked(true);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [ready, settings.appLockEnabled, settings.appLockTimeout]);

  const unlockApp = useCallback(() => {
    lastBackgroundTime.current = null;
    setIsLocked(false);
  }, []);

  // Keep the OS background colour (keyboard area, splash fade) in sync.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.background);
  }, [theme.background]);

  if (!ready || !lockReady) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.navigator, { backgroundColor: theme.background }]}>
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
          // Parallax push: the new screen slides in while the old one drifts and dims.
          animation: reduceMotion ? 'none' : 'ios_from_right',
        }}
      >
        <Stack.Protected guard={!settings.onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={settings.onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="chat-settings" options={{ title: 'Detector settings' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="terms" options={{ title: 'Terms & Conditions' }} />
          <Stack.Screen name="protected-apps" options={{ title: 'Choose apps' }} />
          <Stack.Screen name="detections/[id]" options={{ title: 'Detection' }} />
          <Stack.Screen name="alerts" options={{ title: 'Alerts' }} />
          <Stack.Screen name="apps/index" options={{ title: 'Protected apps' }} />
          <Stack.Screen name="apps/[packageName]" options={{ title: 'App' }} />
          <Stack.Screen name="monitor-preview" options={{ title: 'Monitor preview' }} />
          <Stack.Screen name="learn/[id]" options={{ title: 'Lesson' }} />
          <Stack.Screen name="scans/[id]" options={{ title: 'Scan result' }} />
        </Stack.Protected>
      </Stack>
      <DownloadStatusIndicator />
      {settings.onboarded && !isLocked && <FloatingChatButton />}
      {isLocked && Platform.OS === 'android' && (
        <AppLockScreen
          nickname={settings.nickname}
          onUnlock={unlockApp}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navigator: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
