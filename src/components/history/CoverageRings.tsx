import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import type { HistoryDay } from '@/history/data';
import { CoverageArc } from './CoverageArc';
import { useTheme } from '@/theme';
import { typography } from '@/typography';

const METRICS = [
  { key: 'screenMinutes', label: 'Screen time · 7 days', unit: ' min', radius: 72, alpha: '' },
  { key: 'alerts', label: 'Alerts flagged', unit: '', radius: 53, alpha: 'B3' },
  { key: 'scans', label: 'Scans run', unit: '', radius: 34, alpha: '66' },
] as const;
const roundNumber = (value: number) => String(Math.round(value));

export function CoverageRings({ day, loading, reference }: { day: HistoryDay; loading: boolean; reference: { screenMinutes: number; alerts: number; scans: number } }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const metrics = METRICS.map(metric => ({ ...metric, goal: reference[metric.key], color: `${theme.tint}${metric.alpha}` }));
  const label = `${day.screenMinutes === null ? 'Protected-app screen time unavailable' : `${day.screenMinutes} protected-app minutes in the last seven days`}, ${day.alerts} alerts flagged overall, ${day.scans} scans run overall`;
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[typography.cardTitle, { color: theme.text }]}>Overall coverage</Text>
      </View>
      <View style={styles.body}>
        <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.rings}>
          {Platform.OS === 'web' ? (
            <svg width={160} height={160} viewBox="0 0 160 160" aria-hidden style={{ position: 'absolute', inset: 0 }}>
              {metrics.map(metric => <React.Fragment key={metric.key}>
                <circle cx={80} cy={80} r={metric.radius} stroke={theme.border} strokeOpacity={0.7} strokeWidth={15} fill="none" />
                <CoverageArc radius={metric.radius} color={metric.color} goal={metric.goal} value={day[metric.key] ?? 0} reduceMotion={reduceMotion} />
              </React.Fragment>)}
            </svg>
          ) : (
            <Svg width={160} height={160} style={StyleSheet.absoluteFill}>
              {metrics.map(metric => <React.Fragment key={metric.key}>
                <Circle cx={80} cy={80} r={metric.radius} stroke={theme.border} strokeOpacity={0.7} strokeWidth={15} fill="none" />
                <CoverageArc radius={metric.radius} color={metric.color} goal={metric.goal} value={day[metric.key] ?? 0} reduceMotion={reduceMotion} />
              </React.Fragment>)}
            </Svg>
          )}
          <Ionicons name="shield-checkmark-outline" size={25} color={theme.textSecondary} />
        </View>
        <View style={styles.legend}>
          {metrics.map(metric => <View key={metric.key} style={styles.metric}>
            <View style={[styles.dot, { backgroundColor: metric.color }]} />
            <View style={styles.flex}>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>{metric.label}</Text>
              <View style={styles.valueRow} accessible accessibilityLabel={`${metric.label}: ${loading || day[metric.key] === null ? 'unavailable' : `${day[metric.key]}${metric.unit}`}`}>
                {loading || day[metric.key] === null ? <Text style={[typography.statistic, { color: theme.textSecondary }]}>—</Text> : <AnimatedNumber value={day[metric.key] ?? 0} format={roundNumber} duration={reduceMotion ? 0 : 900} style={[typography.statistic, { color: theme.text }]} />}
                {metric.unit && <Text style={[typography.caption, { color: theme.textSecondary }]}>{metric.unit.trim()}</Text>}
              </View>
            </View>
          </View>)}
        </View>
      </View>
      <View style={[styles.footnote, { borderTopColor: theme.border }]}><Ionicons name="information-circle-outline" size={13} color={theme.textSecondary} /><Text style={[typography.caption, styles.footnoteText, { color: theme.textSecondary }]}>Screen time covers protected apps for the last 7 days. Alerts and scans are all time.</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginTop: 16, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 20 },
  body: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  rings: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  legend: { flex: 1, gap: 14 },
  metric: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 5 },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 3, marginTop: 2 },
  footnote: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 12, marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  footnoteText: { flex: 1 },
});
