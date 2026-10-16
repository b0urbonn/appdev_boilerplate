import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { DetectionRow } from '@/components/DetectionRow';
import { listDetectionsForApp, type Detection } from '@/db/detections';
import { appIconUri, launchApp } from '@/monitor/native';
import { useSettings } from '@/settings/SettingsContext';
import { relativeTime } from '@/utils/time';
import { useTheme } from '@/theme';

/** Per-app detail: launcher action plus that app's detection history. */
export default function AppDetailScreen() {
  const theme = useTheme();
  const { packageName } = useLocalSearchParams<{ packageName: string }>();
  const pkg = decodeURIComponent(packageName ?? '');
  const { settings } = useSettings();
  const [detections, setDetections] = useState<Detection[]>([]);

  const app = settings.monitoredApps.find((a) => a.packageName === pkg);
  const label = app?.label ?? pkg;
  const lastAt = detections.length ? detections[0].createdAt : null;

  useEffect(() => {
    if (!pkg) return;
    listDetectionsForApp(pkg).then(setDetections).catch(() => {});
  }, [pkg]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: label }} />
      <FlatList
        contentContainerStyle={styles.list}
        data={detections}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={
          <View style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Image source={{ uri: appIconUri(pkg) }} style={styles.icon} />
            <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {detections.length} alert{detections.length === 1 ? '' : 's'}
              {lastAt ? ` · last alert ${relativeTime(lastAt).toLowerCase()}` : ''}
            </Text>
            <Button
              label={`Open ${label}`}
              icon="open-outline"
              onPress={() => void launchApp(pkg)}
              style={{ marginTop: 10 }}
            />
          </View>
        }
        renderItem={({ item }) => <DetectionRow detection={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={48} color={theme.success} />
            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
              No alerts for {label} yet.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  headerCard: {
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  icon: { width: 64, height: 64, borderRadius: 16 },
  label: { fontSize: 20, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, flex: 1 },
});
