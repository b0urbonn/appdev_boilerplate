import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { SmoothPressable } from '@/components/SmoothPressable';
import { verdictLabel } from '@/db/detections';
import type { ScanKind } from '@/db/scans';
import type { HistoryItem } from '@/history/data';
import { relativeTime } from '@/utils/time';
import { useTheme } from '@/theme';
import { typography } from '@/typography';

const ICON: Record<ScanKind, React.ComponentProps<typeof Ionicons>['name']> = {
  image: 'image-outline', video: 'videocam-outline', audio: 'mic-outline', text: 'document-text-outline',
};

export function TimelineList({ items, selectionKey, loading, failed, groupByDay = false }: { items: HistoryItem[]; selectionKey: string; loading: boolean; failed: boolean; groupByDay?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  if (!items.length && failed) return null;
  if (!items.length) return <View style={[styles.empty, { borderColor: theme.border }]}>
    <Ionicons name="time-outline" size={30} color={theme.textSecondary} />
    <Text style={[typography.body, styles.emptyText, { color: theme.textSecondary }]}>{loading ? 'Loading saved activity…' : 'No saved activity for this selection.'}</Text>
  </View>;
  return <View key={selectionKey} style={styles.list}>
    {items.map((item, index) => {
      const alert = item.kind === 'alert';
      const record = item.kind === 'alert' ? item.detection : item.scan;
      const safe = record.verdict === 'safe';
      const title = item.kind === 'alert' ? item.detection.appLabel : `${verdictLabel(item.scan.verdict)} · ${item.scan.kind[0].toUpperCase()}${item.scan.kind.slice(1)}`;
      const time = new Date(item.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const date = new Date(item.at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
      const showDate = groupByDay && (index === 0 || new Date(items[index - 1].at).toDateString() !== new Date(item.at).toDateString());
      const accessibilityLabel = `${item.sample ? 'Sample preview: ' : ''}${title}, ${record.confidence}% confidence, ${time}${item.sample ? '' : '. Open report'}`;
      return <Animated.View key={`${selectionKey}-${item.key}`} entering={reduceMotion || Platform.OS === 'web' ? undefined : FadeInDown.duration(400).easing(Easing.bezier(.22, .68, 0, 1)).delay(Math.min(index, 10) * 60).withInitialValues({ transform: [{ translateY: 10 }] })}>
        {showDate && <Text accessibilityRole="header" style={[typography.caption, styles.dateHeading, { color: theme.textSecondary }]}>{date}</Text>}
        <SmoothPressable accessibilityLabel={accessibilityLabel} hitSlop={0} disabled={item.sample} onPress={() => router.push(`/${alert ? 'detections' : 'scans'}/${record.id}` as Href)} style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.icon, { backgroundColor: theme.buttonSecondary }]}>{item.kind === 'alert' ? <View style={styles.alertGlyph}><Ionicons name="shield-outline" size={23} color={theme.danger} /><Text style={[styles.warningGlyph, { color: theme.danger }]}>!</Text></View> : <Ionicons name={ICON[item.scan.kind]} size={22} color={theme.tint} />}</View>
          <View style={styles.copy}>
            <Text style={[typography.label, { color: theme.text }]} numberOfLines={2}>{title}</Text>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>{alert ? `${verdictLabel(record.verdict)} · ${record.confidence}%` : relativeTime(item.at)}</Text>
          </View>
          {alert ? <Text style={[styles.time, { color: theme.textSecondary }]}>{time}</Text> : <View style={[styles.confidence, { backgroundColor: safe ? theme.success : theme.danger }]}>
            <Text style={[styles.confidenceText, { color: '#FFFFFF' }]}>{record.confidence}%</Text>
          </View>}
        </SmoothPressable>
      </Animated.View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alertGlyph: { alignItems: 'center', justifyContent: 'center' },
  warningGlyph: { position: 'absolute', top: 2, fontSize: 13, fontWeight: '700' },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  dateHeading: { marginTop: 12, marginBottom: 10, fontWeight: '600' },
  time: { fontSize: 12, fontVariant: ['tabular-nums'] },
  confidence: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  confidenceText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingVertical: 28, paddingHorizontal: 16, marginTop: 12 },
  emptyText: { textAlign: 'center' },
});
