import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { CoverageRings } from '@/components/history/CoverageRings';
import { TimelineList } from '@/components/history/TimelineList';
import { listDetections, type Detection } from '@/db/detections';
import { listScans, type Scan } from '@/db/scans';
import {
  calculateHistoryStreak,
  filterHistory,
  historyWeekStarts,
  localDayStart,
  mergeHistoryItems,
  nextLocalDay,
  type HistoryDay,
  type HistoryFilter,
} from '@/history/data';
import { StreakDetailsModal } from '@/components/StreakDetailsModal';
import { getDailyUsage, hasUsageAccess } from '@/monitor/native';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';
import { typography } from '@/typography';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'alerts', label: 'Alerts' }, { id: 'scans', label: 'Scans' },
];

/** Recent items shown on the timeline before the "See all" expansion. */
const RECENT_LIMIT = 10;

/** Local saved records are loaded independently of optional Android usage access. */
export default function HistoryScreen() {
  const theme = useTheme();
  const { settings } = useSettings();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [today, setToday] = useState(() => localDayStart(Date.now()));
  const [detections, setDetections] = useState<Detection[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState({ alerts: false, scans: false });
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<{ key: string; values: number[] | null }>({ key: '', values: null });
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const packages = useMemo(() => settings.monitoredApps.map(app => app.packageName), [settings.monitoredApps]);
  const starts = useMemo(() => historyWeekStarts(today), [today]);
  const usageKey = `${starts[0]}:${packages.join(',')}`;

  useFocusEffect(useCallback(() => {
    let active = true;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      const currentDay = localDayStart(Date.now());
      if (currentDay !== today) { setToday(currentDay); return; }
      busy = true;
      setLoading(true);
      try {
        // A usage-permission or native-module failure cannot suppress saved scans.
        const results = await Promise.allSettled([listDetections(), listScans()]);
        if (!active) return;
        if (results[0].status === 'fulfilled') setDetections(results[0].value);
        setAvailable(previous => ({ alerts: previous.alerts || results[0].status === 'fulfilled', scans: previous.scans || results[1].status === 'fulfilled' }));
        if (results[1].status === 'fulfilled') setScans(results[1].value);
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length) {
          const cause = failures[0].status === 'rejected' ? String(failures[0].reason) : '';
          console.warn('Unable to read saved history:', cause);
          setError(/Access Handle|Invalid VFS|another.*tab/i.test(cause)
            ? 'Close other Maalam browser tabs to access saved history.'
            : failures.length === 1 ? 'Some saved activity is unavailable.' : 'Saved history is unavailable.');
        } else {
          setError('');
        }
        setLoaded(true);
      } finally {
        busy = false;
        if (active) setLoading(false);
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 60_000);
    return () => { active = false; if (refreshRef.current === refresh) refreshRef.current = null; subscription.remove(); clearInterval(timer); };
  }, [today]));

  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    const readUsage = async () => {
      let values: number[] | null = null;
      try {
        if (hasUsageAccess() && packages.length) values = await getDailyUsage(packages, starts);
      } catch (cause) { console.warn('Protected-app usage unavailable:', cause); }
      if (active) setUsage({ key: usageKey, values });
    };
    void readUsage();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void readUsage(); });
    return () => { active = false; subscription.remove(); };
  }, [packages, starts, usageKey]));

  const allItems = useMemo(() => mergeHistoryItems(detections, scans), [detections, scans]);
  const screenUsage = usage.key === usageKey ? usage.values : null;
  const coverage = useMemo<HistoryDay>(() => ({
    start: starts[0],
    screenMinutes: screenUsage === null ? null : screenUsage.reduce((total, value) => total + Math.round(value / 60_000), 0),
    alerts: detections.length,
    scans: scans.length,
    items: allItems,
  }), [starts, screenUsage, detections, scans, allItems]);
  const streakInfo = useMemo(
    () => calculateHistoryStreak(detections, scans, today),
    [detections, scans, today]
  );
  const items = filterHistory(allItems, filter);
  const [showAll, setShowAll] = useState(false);
  const recentItems = items.slice(0, RECENT_LIMIT);
  const hasMore = items.length > RECENT_LIMIT;
  const hiddenCount = items.length - RECENT_LIMIT;
  const dayCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of items) {
      const day = localDayStart(item.at);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0] - a[0]);
  }, [items]);
  const refresh = () => { void refreshRef.current?.(); };

  return <View style={[styles.container, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading && loaded} onRefresh={refresh} tintColor={theme.tint} colors={[theme.tint]} />}>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={[typography.screenTitle, styles.title, { color: theme.text }]}>History</Text>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel={`Safety streak: ${streakInfo.streak} day${streakInfo.streak === 1 ? '' : 's'}. Based on daily alerts and scans. Tap to view details.`}
          onPress={() => setStreakModalOpen(true)}
          style={[styles.streakBadge, { backgroundColor: theme.card, borderColor: streakInfo.streak > 0 ? 'rgba(255, 107, 0, 0.4)' : theme.border }]}
        >
          <Ionicons name={streakInfo.streak > 0 ? 'flame' : 'flame-outline'} size={16} color={streakInfo.streak > 0 ? '#FF6B00' : theme.textSecondary} />
          <Text style={[styles.streakNumber, { color: streakInfo.streak > 0 ? theme.text : theme.textSecondary }]}>{streakInfo.streak}</Text>
          <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>{streakInfo.streak === 1 ? 'day streak' : 'days streak'}</Text>
        </SmoothPressable>
      </View>
      <View accessibilityRole="toolbar" accessibilityLabel="Filter history" style={styles.filters}>
        {FILTERS.map(option => <SmoothPressable key={option.id} hitSlop={0} accessibilityLabel={`${option.label} filter`} accessibilityState={{ selected: filter === option.id }} onPress={() => { setFilter(option.id); setShowAll(false); }} style={[styles.chip, { backgroundColor: filter === option.id ? theme.buttonPrimary : theme.buttonSecondary }]}>
          <Text style={[typography.chip, { color: filter === option.id ? '#FFFFFF' : theme.textSecondary }]}>{option.label}</Text>
        </SmoothPressable>)}
      </View>

      <CoverageRings day={coverage} loading={!loaded || !!error || !available.alerts || !available.scans} reference={{ screenMinutes: Math.max(120, coverage.screenMinutes ?? 0), alerts: Math.max(5, coverage.alerts), scans: Math.max(8, coverage.scans) }} />

      {!!error && <View style={[styles.error, { backgroundColor: theme.card, borderColor: theme.border }]}><Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} /><Text accessibilityRole="alert" style={[typography.caption, styles.flex, { color: theme.textSecondary }]}>{error}</Text><Button label="Retry" variant="secondary" onPress={refresh} /></View>}
      <View style={styles.timelineHeading}><Text accessibilityRole="header" style={[typography.sectionTitle, { color: theme.text }]}>Timeline</Text><Text style={[typography.caption, { color: theme.textSecondary }]}>{showAll ? `${items.length} ${items.length === 1 ? 'item' : 'items'}` : `Recent ${recentItems.length} of ${items.length}`}</Text></View>
      {showAll && dayCounts.length > 0 && (
        <View style={[styles.daySummary, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.daySummaryHeader}>
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
            <Text accessibilityRole="header" style={[typography.caption, styles.daySummaryTitle, { color: theme.textSecondary }]}>Activity by day</Text>
          </View>
          <View style={styles.dayCells}>
            {dayCounts.map(([day, count]) => {
              const date = new Date(day);
              const currentYear = date.getFullYear() === new Date().getFullYear();
              const sameMonth = currentYear && date.getMonth() === new Date().getMonth();
              const dayName = day === today ? 'Today' : day === nextLocalDay(today, -1) ? 'Yesterday' : date.toLocaleDateString(undefined, { weekday: 'short' });
              return <View key={day} style={[styles.dayCell, { backgroundColor: theme.buttonSecondary }]}>
                <Text style={[styles.dayCellName, { color: theme.textSecondary }]} numberOfLines={1}>{dayName}</Text>
                <Text style={[styles.dayCellDate, { color: theme.text }]}>{sameMonth ? `${date.getDate()}` : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                <Text style={[styles.dayCellCount, { color: theme.tint }]}>{count} {count === 1 ? 'item' : 'items'}</Text>
              </View>;
            })}
          </View>
        </View>
      )}
      <TimelineList items={showAll ? items : recentItems} selectionKey={`overall-${filter}-${showAll}`} loading={loading && !loaded} failed={!!error} groupByDay />
      {hasMore && !showAll && (
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel={`See complete history, ${hiddenCount} more items grouped by day`}
          onPress={() => setShowAll(true)}
          style={[styles.seeAll, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Ionicons name="calendar-outline" size={16} color={theme.tint} />
          <Text style={[typography.label, styles.flex, { color: theme.tint }]}>See complete history</Text>
          <Text style={[typography.caption, { color: theme.textSecondary }]}>+{hiddenCount} more</Text>
          <Ionicons name="chevron-down" size={16} color={theme.tint} />
        </SmoothPressable>
      )}
      {hasMore && showAll && (
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel="Show only recent items"
          onPress={() => setShowAll(false)}
          style={[styles.seeAll, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={[typography.label, styles.flex, { color: theme.tint }]}>Show recent only</Text>
          <Ionicons name="chevron-up" size={16} color={theme.tint} />
        </SmoothPressable>
      )}
    </ScrollView>
    <StreakDetailsModal
      visible={streakModalOpen}
      onClose={() => setStreakModalOpen(false)}
      streak={streakInfo.streak}
      todayAlerts={streakInfo.todayAlerts}
      todayScans={streakInfo.todayScans}
      activeToday={streakInfo.activeToday}
      historyDays={streakInfo.historyDays}
    />
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 },
  title: { marginBottom: 0 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  streakNumber: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  streakLabel: { fontSize: 12, fontWeight: '600' },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: { minHeight: 40, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  timelineHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  daySummary: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, marginBottom: 12 },
  daySummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  daySummaryTitle: { fontWeight: '600' },
  dayCells: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayCell: { minWidth: 76, alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  dayCellName: { fontSize: 11, fontWeight: '600' },
  dayCellDate: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dayCellCount: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  error: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 16 },
});
