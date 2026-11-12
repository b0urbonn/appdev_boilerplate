import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EmptyState, FlowTaskPage, PageHeading, ScreenScroll, flowStyles } from '@/components/FlowTaskUI';
import { FlowText as Text } from '@/components/FlowText';
import { TapPressable as Pressable } from '@/components/TapPressable';
import { localize, localeFor } from '@/i18n';
import { useSettings } from '@/settings/SettingsContext';
import { addDays, dateKey, useFlowTasks } from '@/tasks/FlowTasksContext';
import { useTheme } from '@/theme';

export default function WeeklyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const locale = localeFor(settings.language);
  const { tasks } = useFlowTasks();
  const days = useMemo(() => {
    const now = new Date();
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(monday, index);
      return { key: dateKey(date), label: date.toLocaleDateString(locale, { weekday: 'short' }) };
    });
  }, [locale]);
  const [selectedDay, setSelectedDay] = useState(dateKey(new Date()));
  const weekTasks = tasks.filter(task => task.date >= days[0].key && task.date <= days[6].key);
  const completedTasks = weekTasks.filter(task => task.completed);
  const focusMinutes = completedTasks.reduce((sum, task) => sum + task.duration, 0);
  const selectedTasks = tasks.filter(task => task.date === selectedDay && task.completed);
  const maxCount = Math.max(1, ...days.map(day => tasks.filter(task => task.date === day.key && task.completed).length));

  return (
    <FlowTaskPage onProfilePress={() => router.navigate('/preferences' as Href)}>
      <ScreenScroll>
        <PageHeading eyebrow={localize(settings.language, 'YOUR PROGRESS', 'IYONG PAG-UNLAD')} title={localize(settings.language, 'Progress', 'Pag-unlad')} subtitle={`${new Date(`${days[0].key}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${new Date(`${days[6].key}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`} />
        <View style={[styles.statsRow, { gap: 9 }]}>
          <StatCard icon="checkmark-circle-outline" label={localize(settings.language, 'Tasks completed', 'Natapos na gawain')} value={String(completedTasks.length)} caption={`${localize(settings.language, 'of', 'sa')} ${weekTasks.length} ${localize(settings.language, 'planned', 'nakaplano')}`} />
          <StatCard icon="time-outline" label={localize(settings.language, 'Focus time', 'Oras ng pokus')} value={`${Math.floor(focusMinutes / 60)}h ${focusMinutes % 60}m`} caption={localize(settings.language, 'Time well spent', 'Oras na nagamit nang mabuti')} />
        </View>
        <View style={[flowStyles.card, styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[flowStyles.sectionTitle, { color: theme.text }]}>{localize(settings.language, 'Your activity', 'Iyong aktibidad')}</Text>
          <Text style={[styles.chartSubtitle, { color: theme.textSecondary }]}>{localize(settings.language, 'Completed tasks each day', 'Mga natapos na gawain bawat araw')}</Text>
          <View style={styles.chart}>
            {days.map(day => {
              const count = tasks.filter(task => task.date === day.key && task.completed).length;
              const selected = day.key === selectedDay;
              const height = Math.max(8, Math.round((count / maxCount) * 112));
              return <Pressable key={day.key} accessibilityRole="button" accessibilityLabel={`${day.label}: ${count} ${localize(settings.language, 'tasks completed', 'natapos na gawain')}`} onPress={() => setSelectedDay(day.key)} style={styles.barColumn}>
                <Text style={[styles.barCount, { color: theme.tint }]}>{count || ''}</Text>
                <View style={[styles.barTrack, { backgroundColor: theme.buttonSecondary }]}><View style={{ height, backgroundColor: selected ? theme.tint : theme.border, borderRadius: 8 }} /></View>
                <Text style={[styles.barLabel, { color: selected ? theme.tint : theme.textSecondary }]}>{day.label.slice(0, 1)}</Text>
              </Pressable>;
            })}
          </View>
          <View style={styles.chartCaption}><Ionicons name="sparkles-outline" size={14} color={theme.tint} /><Text style={[styles.chartCaptionText, { color: theme.textSecondary }]}>{localize(settings.language, 'Small steps add up. You’re doing great.', 'Nagkakabunga ang maliliit na hakbang. Magaling ang ginagawa mo.')}</Text></View>
        </View>
        <View style={flowStyles.sectionHeading}><View><Text style={[styles.kicker, { color: theme.textSecondary }]}>{localize(settings.language, 'DAY IN FOCUS', 'ARAW NA NAKATUTOK')}</Text><Text style={[flowStyles.sectionTitle, { color: theme.text }]}>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}</Text></View><Text style={[styles.doneBadge, { color: theme.tint, backgroundColor: theme.buttonSecondary }]}>{selectedTasks.length} {localize(settings.language, 'completed', 'natapos')}</Text></View>
        {selectedTasks.length ? selectedTasks.map(task => <View key={task.id} style={[styles.completedRow, { borderTopColor: theme.border }]}><View style={[styles.checkMark, { backgroundColor: theme.buttonPrimary }]}><Ionicons name="checkmark" size={13} color={theme.text} /></View><Text style={[styles.completedTitle, { color: theme.text }]}>{task.title}</Text><Text style={[styles.taskTime, { color: theme.textSecondary }]}>{task.time}</Text></View>) : <EmptyState title={localize(settings.language, 'A fresh start', 'Bagong simula')} body={localize(settings.language, 'Completed tasks will show up here as you move through your week.', 'Lalabas dito ang mga natapos mong gawain habang nagpapatuloy ang linggo.')} icon="bar-chart-outline" />}
      </ScreenScroll>
    </FlowTaskPage>
  );
}

function StatCard({ icon, label, value, caption }: { icon: 'checkmark-circle-outline' | 'time-outline'; label: string; value: string; caption: string }) {
  const theme = useTheme();
  return <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}><View style={[styles.statIcon, { backgroundColor: theme.buttonSecondary }]}><Ionicons name={icon} size={17} color={theme.tint} /></View><Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: theme.text }]}>{value}</Text><Text style={[styles.statCaption, { color: theme.textSecondary }]}>{caption}</Text></View>;
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', marginBottom: 13 },
  statCard: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 16, padding: 13 },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statLabel: { fontSize: 9, fontWeight: '700' },
  statValue: { fontSize: 23, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 },
  statCaption: { fontSize: 8, marginTop: 4 },
  chartCard: { marginTop: 2 },
  chartSubtitle: { fontSize: 10, marginTop: 4 },
  chart: { height: 168, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 15 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  barCount: { height: 12, fontSize: 8, fontWeight: '800' },
  barTrack: { width: 20, height: 116, justifyContent: 'flex-end', borderRadius: 8, overflow: 'hidden' },
  barLabel: { fontSize: 9, fontWeight: '800' },
  chartCaption: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  chartCaptionText: { fontSize: 9 },
  kicker: { fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  doneBadge: { overflow: 'hidden', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: '800' },
  completedRow: { minHeight: 42, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkMark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  completedTitle: { flex: 1, fontSize: 10, fontWeight: '700' },
  taskTime: { fontSize: 9 },
});
