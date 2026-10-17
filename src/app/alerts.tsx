import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { DetectionRow } from '@/components/DetectionRow';
import { SmoothPressable } from '@/components/SmoothPressable';
import { listDetectionsSince, type Detection } from '@/db/detections';
import { useSettings } from '@/settings/SettingsContext';
import type { Settings } from '@/settings/storage';
import { useTheme } from '@/theme';

/** New (unread) detections since the alerts view was last opened. */
export default function AlertsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [detections, setDetections] = useState<Detection[]>([]);

  // Always-current settings for the focus callback, which must not re-run
  // when alertsSeenAt itself is updated below.
  const settingsRef = useRef<Settings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const since = settingsRef.current.alertsSeenAt;
      listDetectionsSince(since)
        .then((rows) => { if (active) setDetections(rows); })
        .catch(() => {});
      // Everything listed stays visible this visit; the badge clears.
      void update('alertsSeenAt', Date.now());
      return () => { active = false; };
    }, [update])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        contentContainerStyle={styles.list}
        data={detections}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <DetectionRow detection={item} />}
        ListHeaderComponent={
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>New</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={theme.success} />
            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
              You are all caught up.
            </Text>
          </View>
        }
        ListFooterComponent={
          <SmoothPressable
            accessibilityRole="link"
            accessibilityLabel="See full history"
            onPress={() => router.push('/(tabs)/history' as Href)}
            style={styles.footerLink}
          >
            <Text style={{ color: theme.tint, fontSize: 14, fontWeight: '600' }}>
              See full history
            </Text>
          </SmoothPressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  footerLink: { alignSelf: 'center', paddingVertical: 16 },
});
