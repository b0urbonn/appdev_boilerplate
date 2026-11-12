import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AddTaskSheet, EmptyState, FlowTaskPage, TaskCard } from '@/components/FlowTaskUI';
import { FlowText as Text } from '@/components/FlowText';
import { TapPressable as Pressable } from '@/components/TapPressable';
import { localize, localeFor } from '@/i18n';
import { useSettings } from '@/settings/SettingsContext';
import { addDays, dateKey, FlowTask, useFlowTasks } from '@/tasks/FlowTasksContext';
import { useTheme } from '@/theme';

type CalendarView = 'Year' | 'Month' | 'Week' | 'Day' | 'Schedule';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const VIEWS: { label: CalendarView; icon: IconName }[] = [
  { label: 'Year', icon: 'calendar-clear-outline' },
  { label: 'Month', icon: 'calendar-outline' },
  { label: 'Week', icon: 'grid-outline' },
  { label: 'Day', icon: 'today-outline' },
  { label: 'Schedule', icon: 'list-outline' },
];

export default function CalendarScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const locale = localeFor(settings.language);
  const { tasks } = useFlowTasks();
  const todayKey = dateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState<CalendarView>('Month');
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [suggestion, setSuggestion] = useState<{ date: string; scheduleKey: string; text: string } | null>(null);
  const dayTasks = useMemo(() => tasks.filter(task => task.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)), [tasks, selectedDate]);
  const scheduleKey = JSON.stringify(dayTasks.map(({ id, title, time, duration, category, priority, completed }) => ({ id, title, time, duration, category, priority, completed })));
  const selectedTasks = useMemo(() => dayTasks.filter(task => matches(task, search)), [dayTasks, search]);
  const generateSuggestion = () => setSuggestion({
    date: selectedDate,
    scheduleKey,
    text: createScheduleSuggestion(dayTasks),
  });
  const goMonth = (amount: number) => {
    const target = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    const day = new Date(`${selectedDate}T12:00:00`).getDate();
    const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    setMonth(target);
    setSelectedDate(dateKey(new Date(target.getFullYear(), target.getMonth(), Math.min(day, maxDay))));
  };
  const pickDate = (key: string) => {
    setSelectedDate(key);
    setMonth(new Date(`${key}T12:00:00`));
  };

  return (
    <FlowTaskPage onProfilePress={() => router.navigate('/preferences' as Href)}>
      <View style={styles.flex}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.toolbar}>
            <IconButton icon="menu" label={localize(settings.language, 'Open calendar views', 'Buksan ang mga view ng kalendaryo')} onPress={() => setDrawer(true)} />
            <Text style={[styles.title, { color: theme.text }]}>{localize(settings.language, 'Calendar', 'Kalendaryo')}</Text>
            <IconButton icon="search-outline" label={localize(settings.language, 'Search calendar', 'Maghanap sa kalendaryo')} onPress={() => { setSearchOpen(value => !value); setSearch(''); }} />
            <Pressable onPress={() => pickDate(todayKey)} style={[styles.todayButton, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.textSecondary, fontSize: 9, fontWeight: '700' }}>{localize(settings.language, 'Today', 'Ngayon')}</Text><Text style={[styles.todayNumber, { color: theme.text }]}>{new Date().getDate()}</Text></Pressable>
          </View>
          {searchOpen ? <View style={[styles.searchField, { borderColor: theme.border, backgroundColor: theme.card }]}><Ionicons name="search-outline" size={16} color={theme.textSecondary} /><TextInput autoFocus value={search} onChangeText={setSearch} placeholder={localize(settings.language, 'Find a task', 'Maghanap ng gawain')} placeholderTextColor={theme.textSecondary} style={[styles.searchInput, { color: theme.text }]} /><Pressable onPress={() => { setSearch(''); setSearchOpen(false); }}><Ionicons name="close" size={17} color={theme.textSecondary} /></Pressable></View> : null}
          <View style={[styles.suggestionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.suggestionHeading}>
              <View style={[styles.suggestionIcon, { backgroundColor: theme.buttonSecondary }]}><Ionicons name="sparkles" size={16} color={theme.tint} /></View>
              <Text style={[styles.suggestionLabel, { color: theme.text }]}>{localize(settings.language, 'SUGGESTIONS', 'MGA MUNGKAHI')}</Text>
            </View>
            {suggestion?.date === selectedDate && suggestion.scheduleKey === scheduleKey
              ? <Text style={[styles.suggestionText, { color: theme.text }]}>{suggestion.text}</Text>
              : <Text style={[styles.suggestionText, { color: theme.textSecondary }]}>{localize(settings.language, 'Get a planning idea based on your schedule for', 'Kumuha ng mungkahi batay sa iskedyul mo para sa')} {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}.</Text>}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${localize(settings.language, 'Suggest a plan based on your schedule for', 'Magmungkahi ng plano batay sa iskedyul para sa')} ${new Date(`${selectedDate}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`}
              onPress={generateSuggestion}
              style={[styles.suggestionButton, { backgroundColor: theme.buttonSecondary }]}
            >
              <Ionicons name="sparkles-outline" size={15} color={theme.tint} />
            </Pressable>
          </View>
          {view === 'Month' ? <>
            <View style={[styles.monthCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.monthHeader}>
                <IconButton icon="chevron-back" label="Previous month" onPress={() => goMonth(-1)} />
                <Text style={[styles.monthTitle, { color: theme.text }]}>{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</Text>
                <IconButton icon="chevron-forward" label="Next month" onPress={() => goMonth(1)} />
              </View>
              <CalendarGrid month={month} selected={selectedDate} today={todayKey} tasks={tasks} locale={locale} onSelect={pickDate} />
            </View>
            <Agenda date={selectedDate} tasks={selectedTasks} />
          </> : null}
          {view === 'Year' ? <View style={styles.yearGrid}>{Array.from({ length: 12 }, (_, index) => {
            const yearMonth = new Date(month.getFullYear(), index, 1);
            const count = tasks.filter(task => task.date.startsWith(`${yearMonth.getFullYear()}-${String(index + 1).padStart(2, '0')}`)).length;
            return <Pressable key={index} onPress={() => { setMonth(yearMonth); setView('Month'); }} style={[styles.yearCard, { backgroundColor: theme.card, borderColor: month.getMonth() === index ? theme.tint : theme.border }]}>
              <Text style={[styles.yearMonth, { color: theme.text }]}>{yearMonth.toLocaleDateString(locale, { month: 'short' })}</Text>
              <Text style={[styles.yearCount, { color: theme.textSecondary }]}>{count} {count === 1 ? 'task' : 'tasks'}</Text>
              <MiniMonth month={yearMonth} />
            </Pressable>;
          })}</View> : null}
          {view === 'Week' ? <>
            <WeekStrip selected={selectedDate} tasks={tasks} locale={locale} onSelect={setSelectedDate} />
            <Agenda date={selectedDate} tasks={selectedTasks} />
          </> : null}
          {view === 'Day' ? <Agenda date={selectedDate} tasks={selectedTasks} large /> : null}
          {view === 'Schedule' ? <Schedule tasks={tasks.filter(task => matches(task, search))} locale={locale} /> : null}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => setShowAdd(true)} style={[styles.fab, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.fabText, { color: theme.text }]}>{localize(settings.language, 'Add on', 'Idagdag sa')} {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</Text>
          <View style={[styles.fabPlus, { backgroundColor: theme.buttonPrimary }]}><Ionicons name="add" size={22} color={theme.text} /></View>
        </Pressable>
      </View>
      <CalendarDrawer visible={drawer} selected={view} tasks={tasks} onClose={() => setDrawer(false)} onSelect={next => { setView(next); setDrawer(false); }} />
      <AddTaskSheet visible={showAdd} initialDate={selectedDate} onClose={() => setShowAdd(false)} />
    </FlowTaskPage>
  );
}

function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.card }]}><Ionicons name={icon} size={18} color={theme.textSecondary} /></Pressable>;
}

function CalendarGrid({ month, selected, today, tasks, locale, onSelect }: { month: Date; selected: string; today: string; tasks: FlowTask[]; locale: string; onSelect: (date: string) => void }) {
  const theme = useTheme();
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(new Date(month.getFullYear(), month.getMonth(), 1), index - offset);
    return { date, key: dateKey(date), inMonth: date.getMonth() === month.getMonth() };
  });
  return <View>
    <View style={styles.weekdayRow}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekday, { color: index === 6 ? theme.danger : theme.textSecondary }]}>{day}</Text>)}</View>
    <View style={styles.monthGrid}>{days.map(({ date, key, inMonth }) => {
      const active = selected === key;
      const isToday = today === key;
      const hasTasks = tasks.some(task => task.date === key);
      return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })} onPress={() => onSelect(key)} style={[styles.monthDay, { backgroundColor: active ? theme.buttonSecondary : 'transparent', borderColor: active ? theme.tint : 'transparent' }, !inMonth && styles.outsideMonth]}>
        <Text style={[styles.monthDayNumber, { color: isToday ? '#193B29' : date.getDay() === 0 ? theme.danger : theme.text }, isToday && { backgroundColor: theme.buttonPrimary }, active && !isToday && { color: theme.tint }]}>{date.getDate()}</Text>
        <View style={[styles.taskMarker, { backgroundColor: hasTasks ? theme.tint : 'transparent' }]} />
      </Pressable>;
    })}</View>
  </View>;
}

function Agenda({ date, tasks, large = false }: { date: string; tasks: FlowTask[]; large?: boolean }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const locale = localeFor(settings.language);
  const parsed = new Date(`${date}T12:00:00`);
  return <View style={styles.agenda}>
    <View style={styles.agendaHeader}>
      {large ? <Text style={[styles.agendaDayNumber, { color: theme.text }]}>{parsed.getDate()}</Text> : null}
      <View style={styles.agendaTitleWrap}><Text style={[styles.eyebrow, { color: theme.textSecondary }]}>{parsed.toLocaleDateString(locale, { weekday: 'long' }).toUpperCase()}</Text><Text style={[styles.agendaTitle, { color: theme.text }]}>{parsed.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })}</Text></View>
      <Text style={[styles.taskCount, { color: theme.tint, backgroundColor: theme.buttonSecondary }]}>{tasks.length} {localize(settings.language, tasks.length === 1 ? 'task' : 'tasks', 'gawain')}</Text>
    </View>
    {tasks.length ? tasks.map(task => <TaskCard key={task.id} task={task} />) : <EmptyState title={localize(settings.language, 'Your day is open', 'May bakante ka pa')} body={localize(settings.language, 'Add a task when you’re ready to give this day a little shape.', 'Magdagdag ng gawain kapag handa ka nang magplano para sa araw na ito.')} icon="calendar-outline" />}
  </View>;
}

function WeekStrip({ selected, tasks, locale, onSelect }: { selected: string; tasks: FlowTask[]; locale: string; onSelect: (date: string) => void }) {
  const theme = useTheme();
  const reference = new Date(`${selected}T12:00:00`);
  const monday = addDays(reference, (reference.getDay() + 6) % 7 * -1);
  return <View style={styles.weekStrip}>{Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const key = dateKey(date);
    const active = key === selected;
    return <Pressable key={key} onPress={() => onSelect(key)} style={[styles.weekDate, { backgroundColor: active ? theme.buttonSecondary : theme.card, borderColor: active ? theme.tint : theme.border }]}>
      <Text style={{ color: active ? theme.tint : theme.textSecondary, fontSize: 9, fontWeight: '800' }}>{date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 1)}</Text>
      <Text style={{ color: active ? theme.tint : theme.text, fontSize: 14, fontWeight: '800' }}>{date.getDate()}</Text>
      <View style={[styles.taskMarker, { backgroundColor: tasks.some(task => task.date === key) ? theme.tint : 'transparent' }]} />
    </Pressable>;
  })}</View>;
}

function MiniMonth({ month }: { month: Date }) {
  const theme = useTheme();
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return <View style={styles.miniMonth}>{Array.from({ length: 42 }, (_, index) => {
    const number = index - offset + 1;
    return <View key={index} style={styles.miniDay}><Text style={{ color: number > 0 && number <= days ? theme.textSecondary : 'transparent', fontSize: 6 }}>{number > 0 && number <= days ? number : '·'}</Text></View>;
  })}</View>;
}

function Schedule({ tasks, locale }: { tasks: FlowTask[]; locale: string }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const ordered = tasks.slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const dates = Array.from(new Set(ordered.map(task => task.date)));
  if (!dates.length) return <EmptyState title={localize(settings.language, 'Your schedule is clear', 'Walang nakatakdang gawain')} body={localize(settings.language, 'Scheduled tasks will appear here, organized by date.', 'Lalabas dito ang mga gawain mo ayon sa petsa.')} icon="calendar-outline" />;
  return <View style={styles.schedule}>{dates.map(date => <View key={date}><Text style={[styles.scheduleDate, { color: theme.tint }]}>{new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</Text>{ordered.filter(task => task.date === date).map(task => <TaskCard key={task.id} task={task} />)}</View>)}</View>;
}

function CalendarDrawer({ visible, selected, tasks, onClose, onSelect }: { visible: boolean; selected: CalendarView; tasks: FlowTask[]; onClose: () => void; onSelect: (view: CalendarView) => void }) {
  const theme = useTheme();
  const { settings } = useSettings();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.drawerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close calendar menu" />
        <View style={[styles.drawer, { backgroundColor: theme.card }]}>
          <View style={styles.drawerHeader}><View style={styles.drawerLogo}><View style={styles.brandMark}><Ionicons name="flash" size={16} color="#173B2A" /></View><Text style={[styles.drawerTitle, { color: theme.text }]}>{localize(settings.language, 'Calendar', 'Kalendaryo')}</Text></View><IconButton icon="close" label={localize(settings.language, 'Close calendar menu', 'Isara ang menu ng kalendaryo')} onPress={onClose} /></View>
          <Text style={[styles.eyebrow, { color: theme.textSecondary, marginTop: 23, marginBottom: 8 }]}>{localize(settings.language, 'VIEW', 'VIEW')}</Text>
          {VIEWS.map(item => <Pressable key={item.label} onPress={() => onSelect(item.label)} style={[styles.drawerOption, { backgroundColor: selected === item.label ? theme.buttonSecondary : 'transparent' }]}>
            <Ionicons name={item.icon} size={19} color={selected === item.label ? theme.tint : theme.textSecondary} /><Text style={[styles.drawerOptionText, { color: selected === item.label ? theme.tint : theme.text }]}>{localize(settings.language, item.label, item.label === 'Year' ? 'Taon' : item.label === 'Month' ? 'Buwan' : item.label === 'Week' ? 'Linggo' : item.label === 'Day' ? 'Araw' : 'Iskedyul')}</Text>{selected === item.label ? <Ionicons name="checkmark" size={17} color={theme.tint} /> : null}
          </Pressable>)}
          <View style={[styles.workspaceCard, { backgroundColor: theme.background, borderColor: theme.border }]}><View style={styles.brandMark}><Ionicons name="flash" size={15} color="#173B2A" /></View><View><Text style={[styles.workspaceTitle, { color: theme.text }]}>{localize(settings.language, 'My workspace', 'Aking workspace')}</Text><Text style={[styles.workspaceSubtitle, { color: theme.textSecondary }]}>{tasks.length} {localize(settings.language, tasks.length === 1 ? 'scheduled task' : 'scheduled tasks', 'naka-iskedyul na gawain')}</Text></View></View>
        </View>
      </View>
    </Modal>
  );
}

function matches(task: FlowTask, query: string) {
  return task.title.toLowerCase().includes(query.trim().toLowerCase());
}

function createScheduleSuggestion(tasks: FlowTask[]) {
  const ordered = tasks.slice().sort((a, b) => a.time.localeCompare(b.time));
  const unfinished = ordered.filter(task => !task.completed);

  if (!ordered.length) {
    return 'No tasks are scheduled for this day. Add a task in Your Tasks to get a suggestion based on what you need to do.';
  }
  if (!unfinished.length) {
    const completedTitles = ordered.map(task => `“${task.title}”`).join(', ');
    return `You’ve completed ${completedTitles}. You can take a break or plan your next task.`;
  }

  const nextTask = unfinished[0];
  const taskDetails = (task: FlowTask) => [
    task.category && task.category !== 'Personal' ? task.category : '',
    `${task.priority.toLowerCase()} priority`,
    `${task.duration}-minute`,
  ].filter(Boolean).join(', ');
  const openGap = ordered.slice(0, -1).map((task, index) => {
    const [hours, minutes] = task.time.split(':').map(Number);
    const [nextHours, nextMinutes] = ordered[index + 1].time.split(':').map(Number);
    const end = hours * 60 + minutes + task.duration;
    const nextStart = nextHours * 60 + nextMinutes;
    return { task, nextTask: ordered[index + 1], minutes: nextStart - end };
  }).filter(gap => gap.minutes >= 20 && !gap.nextTask.completed)
    .sort((a, b) => b.minutes - a.minutes)[0];

  if (openGap) {
    return `After “${openGap.task.title},” you have a ${openGap.minutes}-minute gap before “${openGap.nextTask.title}” at ${openGap.nextTask.time}. Take a short break, then get ready for this ${taskDetails(openGap.nextTask)} task.`;
  }
  const followingTask = unfinished[1];
  if (!followingTask) {
    return `Focus on “${nextTask.title}” at ${nextTask.time}. It’s a ${taskDetails(nextTask)} task, so prepare what you need and give it your attention.`;
  }
  return `Start with “${nextTask.title}” at ${nextTask.time} (${taskDetails(nextTask)}), then move on to “${followingTask.title}” at ${followingTask.time}.`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 90 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 15 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  iconButton: { width: 35, height: 35, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  todayButton: { minHeight: 35, borderWidth: 1, borderRadius: 18, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  todayNumber: { width: 22, height: 22, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', borderRadius: 11, backgroundColor: '#8BE0B8', fontSize: 10, fontWeight: '800', paddingTop: 4 },
  searchField: { minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 11, paddingVertical: 6 },
  monthCard: { borderWidth: 1, borderRadius: 18, padding: 11 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  weekdayRow: { flexDirection: 'row', marginBottom: 3 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 9, fontWeight: '800', paddingVertical: 4 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthDay: { width: `${100 / 7}%`, height: 41, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderRadius: 11 },
  monthDayNumber: { minWidth: 22, height: 22, borderRadius: 11, textAlign: 'center', textAlignVertical: 'center', fontSize: 10, fontWeight: '700', overflow: 'hidden', paddingTop: 3 },
  outsideMonth: { opacity: 0.4 },
  taskMarker: { width: 4, height: 4, borderRadius: 2 },
  agenda: { marginTop: 20 },
  agendaHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, marginBottom: 11 },
  agendaDayNumber: { fontSize: 40, fontWeight: '800', lineHeight: 43, letterSpacing: -2 },
  agendaTitleWrap: { flex: 1 },
  eyebrow: { fontSize: 8, letterSpacing: 0.9, fontWeight: '800', marginBottom: 4 },
  agendaTitle: { fontSize: 14, fontWeight: '800' },
  taskCount: { overflow: 'hidden', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '800' },
  weekStrip: { flexDirection: 'row', gap: 5, marginTop: 7, marginBottom: 8 },
  weekDate: { flex: 1, minHeight: 65, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 5 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  yearCard: { width: '31.5%', minHeight: 135, borderWidth: 1, borderRadius: 14, padding: 9 },
  yearMonth: { fontSize: 11, fontWeight: '800' },
  yearCount: { fontSize: 7, marginTop: 2 },
  miniMonth: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 9 },
  miniDay: { width: `${100 / 7}%`, height: 10, alignItems: 'center', justifyContent: 'center' },
  schedule: { gap: 20, paddingTop: 4 },
  scheduleDate: { fontSize: 8, fontWeight: '900', letterSpacing: 1, marginBottom: 9 },
  suggestionCard: { marginTop: 18, borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  suggestionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  suggestionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  suggestionText: { fontSize: 11, lineHeight: 17 },
  suggestionButton: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  fab: { position: 'absolute', bottom: 10, alignSelf: 'center', width: 238, minHeight: 51, borderWidth: 1, borderRadius: 28, paddingLeft: 17, paddingRight: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  fabText: { fontSize: 10, fontWeight: '800' },
  fabPlus: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  drawerBackdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(7,14,10,0.42)' },
  drawer: { width: '82%', maxWidth: 310, paddingTop: 55, paddingHorizontal: 17, paddingBottom: 22, borderTopRightRadius: 24, borderBottomRightRadius: 24 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  drawerLogo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8BE0B8' },
  drawerTitle: { fontSize: 17, fontWeight: '800' },
  drawerOption: { minHeight: 48, borderRadius: 12, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 13 },
  drawerOptionText: { flex: 1, fontSize: 12, fontWeight: '700' },
  workspaceCard: { marginTop: 'auto', borderWidth: 1, borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  workspaceTitle: { fontSize: 10, fontWeight: '800' },
  workspaceSubtitle: { fontSize: 8, marginTop: 3 },
});
