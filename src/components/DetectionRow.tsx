// One alert row: app icon, app label, red verdict chip with confidence and
// relative time. Shared by Alerts, History and the per-app page.
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import { verdictLabel, type Detection } from '@/db/detections';
import { appIconUri } from '@/monitor/native';
import { relativeTime } from '@/utils/time';
import { useTheme } from '@/theme';

export function DetectionRow({ detection }: { detection: Detection }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <SmoothPressable
      accessibilityRole="button"
      accessibilityLabel={`${verdictLabel(detection.verdict)} in ${detection.appLabel}, ${detection.confidence} percent`}
      onPress={() => router.push(`/detections/${detection.id}` as Href)}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <Image source={{ uri: appIconUri(detection.packageName) }} style={styles.icon} />
      <View style={styles.flex}>
        <Text style={[styles.app, { color: theme.text }]} numberOfLines={1}>
          {verdictLabel(detection.verdict)} in {detection.appLabel}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {relativeTime(detection.createdAt)}
        </Text>
      </View>
      <View style={[styles.chip, { backgroundColor: theme.danger }]}>
        <Text style={styles.chipText}>{detection.confidence}%</Text>
      </View>
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  icon: { width: 40, height: 40, borderRadius: 10 },
  app: { fontSize: 15, fontWeight: '600' },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
