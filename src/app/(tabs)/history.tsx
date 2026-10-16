import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { DetectionRow } from '@/components/DetectionRow';
import { SmoothPressable } from '@/components/SmoothPressable';
import { listDetections, type Detection } from '@/db/detections';
import { verdictLabel } from '@/db/detections';
import { listScans, type Scan, type ScanKind } from '@/db/scans';
import { useTheme } from '@/theme';
import { relativeTime } from '@/utils/time';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Filter = 'all' | 'alerts' | 'scans';
type Item =
  | { kind: 'alert'; detection: Detection; at: number; key: string }
  | { kind: 'scan'; scan: Scan; at: number; key: string };

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'scans', label: 'Scans' },
];

const SCAN_ICON: Record<ScanKind, IconName> = {
  video: 'videocam-outline',
  image: 'image-outline',
  audio: 'mic-outline',
  text: 'document-text-outline',
};

function dayBucket(ts: number): string {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  if (ts >= startOfDay.getTime()) return 'Today';
  if (ts >= startOfDay.getTime() - 86400000) return 'Yesterday';
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Everything in one timeline: background alerts plus manual scans. */
export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listDetections(), listScans()])
        .then(([d, s]) => { if (active) { setDetections(d); setScans(s); } })
        .catch(() => {});
      return () => { active = false; };
    }, [])
  );

  const sections = useMemo(() => {
    const items: Item[] = [
      ...(filter !== 'scans'
        ? detections.map((d) => ({ kind: 'alert' as const, detection: d, at: d.createdAt, key: `a-${d.id}` }))
        : []),
      ...(filter !== 'alerts'
        ? scans.map((s) => ({ kind: 'scan' as const, scan: s, at: s.createdAt, key: `s-${s.id}` }))
        : []),
    ].sort((a, b) => b.at - a.at);
    const out: { title: string; data: Item[] }[] = [];
    for (const item of items) {
      const bucket = dayBucket(item.at);
      const last = out[out.length - 1];
      if (last && last.title === bucket) last.data.push(item);
      else out.push({ title: bucket, data: [item] });
    }
    return out;
  }, [detections, scans, filter]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>History</Text>
      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <SmoothPressable
              key={f.id}
              accessibilityRole="button"
              accessibilityLabel={`${f.label} filter`}
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(f.id)}
              style={[
                styles.chip,
                { backgroundColor: active ? theme.buttonPrimary : theme.buttonSecondary },
              ]}
            >
              <Text style={{ color: active ? '#FFFFFF' : theme.textSecondary, fontSize: 14, fontWeight: '600' }}>
                {f.label}
              </Text>
            </SmoothPressable>
          );
        })}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{section.title}</Text>
        )}
        renderItem={({ item }) =>
          item.kind === 'alert' ? (
            <DetectionRow detection={item.detection} />
          ) : (
            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel={`Scan: ${verdictLabel(item.scan.verdict)}`}
              onPress={() => router.push(`/scans/${item.scan.id}` as Href)}
              style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={[styles.scanIcon, { backgroundColor: theme.buttonSecondary }]}>
                <Ionicons name={SCAN_ICON[item.scan.kind] ?? 'document-text-outline'} size={20} color={theme.tint} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                  {verdictLabel(item.scan.verdict)} · {item.scan.kind[0].toUpperCase() + item.scan.kind.slice(1)}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={1}>
                  {relativeTime(item.at)}
                </Text>
              </View>
              <View style={[styles.confChip, { backgroundColor: item.scan.verdict === 'safe' ? theme.success : theme.danger }]}>
                <Text style={styles.confChipText}>{item.scan.confidence}%</Text>
              </View>
            </SmoothPressable>
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={48} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
              {filter === 'scans' ? 'No manual scans yet.'
                : filter === 'alerts' ? 'No alerts yet.'
                : 'Nothing here yet — scans and alerts will appear in one timeline.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  flex: { flex: 1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: 8 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  list: { paddingVertical: 12, gap: 8, flexGrow: 1 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  scanIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  confChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  confChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
