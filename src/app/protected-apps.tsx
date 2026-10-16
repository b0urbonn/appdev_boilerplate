import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppPicker } from '@/components/AppPicker';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

/** Edit which installed apps Maalam monitors in the background. */
export default function ProtectedAppsScreen() {
  const theme = useTheme();
  const { settings, update } = useSettings();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Your allow list</Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Select the installed apps Maalam should monitor. Tap an app to add or remove it; your {settings.monitoredApps.length} selected {settings.monitoredApps.length === 1 ? 'app is' : 'apps are'} saved automatically.
      </Text>
      <AppPicker
        selected={settings.monitoredApps}
        onChange={(apps) => void update('monitoredApps', apps)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
});
