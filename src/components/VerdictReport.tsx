// Shared verdict presentation for detections/[id] and scans/[id]: banner,
// per-finding chips with confidence bars, then the summary.
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { verdictLabel } from '@/db/detections';
import type { MonitorFinding } from '@/monitor/native';
import { useTheme } from '@/theme';

const CATEGORY_LABEL: Record<string, string> = {
  deepfake: 'Deepfake',
  ai_generated: 'AI-generated',
  harmful: 'Harmful',
};

export function VerdictReport({
  verdict,
  confidence,
  summary,
  findings,
}: {
  verdict: 'deepfake' | 'ai_generated' | 'harmful' | 'safe' | string;
  confidence: number;
  summary: string;
  findings: MonitorFinding[];
}) {
  const theme = useTheme();
  const safe = verdict === 'safe';
  const color = safe ? theme.success : theme.danger;
  return (
    <View style={styles.wrap}>
      <View style={[styles.banner, { backgroundColor: color }]}>
        <Ionicons
          name={safe ? 'checkmark-circle-outline' : 'warning-outline'}
          size={22}
          color="#FFFFFF"
        />
        <Text style={styles.bannerText}>
          {safe ? 'Looks safe' : `${verdictLabel(verdict)} detected`} · {confidence}% confidence
        </Text>
      </View>

      {findings.map((f, i) => (
        <View
          key={i}
          style={[styles.finding, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={styles.findingHeader}>
            <View style={[styles.categoryChip, { borderColor: color }]}>
              <Text style={{ color, fontSize: 12, fontWeight: '700' }}>
                {CATEGORY_LABEL[f.category] ?? f.category}
              </Text>
            </View>
            <Text style={[styles.findingLabel, { color: theme.text }]} numberOfLines={1}>
              {f.label}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{f.confidence}%</Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.barFill,
                { backgroundColor: color, width: `${Math.min(100, f.confidence)}%` },
              ]}
            />
          </View>
          {!!f.description && (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{f.description}</Text>
          )}
        </View>
      ))}

      {!!summary && (
        <Text style={{ color: theme.text, fontSize: 15, lineHeight: 21 }}>{summary}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
  },
  bannerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flex: 1 },
  finding: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  findingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  findingLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
