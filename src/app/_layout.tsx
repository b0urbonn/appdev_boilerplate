import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { getDb } from '@/db/client';
import { refreshModelStatus } from '@/ai/local';
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
    <SettingsProvider>
      <RootNavigator />
    </SettingsProvider>
  );
}

/** Shows onboarding until it's completed, then the main app. */
function RootNavigator() {
  const theme = useTheme();
  const { settings, ready } = useSettings();

  // Keep the OS background colour (keyboard area, splash fade) in sync.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.background);
  }, [theme.background]);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Protected guard={!settings.onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={settings.onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="chat-settings" options={{ title: 'Chat settings' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="terms" options={{ title: 'Terms & Conditions' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
