import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlowText as Text } from '@/components/FlowText';
import { TapPressable as Pressable } from '@/components/TapPressable';
import { localize, localeFor } from '@/i18n';
import { useSettings } from '@/settings/SettingsContext';
import { addDays, dateKey, FlowTask, Mood, Priority, useFlowTasks } from '@/tasks/FlowTasksContext';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const MOOD_OPTIONS: { label: Mood; icon: IconName; color: string }[] = [
  { label: 'Great', icon: 'happy-outline', color: '#E1A800' },
  { label: 'Good', icon: 'sunny-outline', color: '#32A879' },
  { label: 'Okay', icon: 'remove-circle-outline', color: '#5585D6' },
  { label: 'Low', icon: 'cloud-outline', color: '#7D74C9' },
  { label: 'Stressed', icon: 'flash-outline', color: '#D46B59' },
];
const TASK_CATEGORIES: { label: string; icon: IconName; color: string }[] = [
  { label: 'Work', icon: 'briefcase-outline', color: '#4C83D8' },
  { label: 'Personal', icon: 'person-outline', color: '#8A68C7' },
  { label: 'Errands', icon: 'cart-outline', color: '#D88A36' },
];
const TASK_PRIORITIES: { label: Priority; icon: IconName; color: string }[] = [
  { label: 'Low', icon: 'arrow-down-outline', color: '#3D9C69' },
  { label: 'Medium', icon: 'remove-outline', color: '#D89928' },
  { label: 'High', icon: 'arrow-up-outline', color: '#D45D53' },
];

export function AppHeader({ onProfilePress }: { onProfilePress?: () => void }) {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [focus, setFocus] = useState(false);
  const focusLabel = localize(settings.language, focus ? 'Focus: On' : 'Focus: Off', focus ? 'Pokus: Naka-on' : 'Pokus: Naka-off');
  return (
    <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={focusLabel} accessibilityState={{ checked: focus }} onPress={() => setFocus(value => !value)} style={[styles.focusButton, { backgroundColor: focus ? theme.buttonPrimary : theme.card, borderColor: theme.border }]}>
          <Ionicons name={focus ? 'radio-button-on-outline' : 'radio-button-off-outline'} size={15} color={focus ? theme.tint : theme.textSecondary} />
          <Text style={{ color: focus ? theme.tint : theme.textSecondary, fontSize: 10, fontWeight: '700' }}>{focusLabel}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={localize(settings.language, 'Toggle appearance', 'Palitan ang itsura')} onPress={() => update('theme', settings.theme === 'light' ? 'dark' : 'light')} style={[styles.headerIcon, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Ionicons name={settings.theme === 'light' ? 'moon-outline' : 'sunny-outline'} size={17} color={theme.textSecondary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={localize(settings.language, 'Open settings', 'Buksan ang settings')} onPress={onProfilePress} style={styles.avatar}>
          <Text style={styles.avatarText}>{settings.nickname.trim().slice(0, 1).toUpperCase() || 'A'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function FlowTaskPage({ children, onProfilePress }: { children: React.ReactNode; onProfilePress?: () => void }) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.page, { backgroundColor: theme.background }]}>
      <AppHeader onProfilePress={onProfilePress} />
      {children}
    </SafeAreaView>
  );
}

export function ScreenScroll({ children, contentStyle }: { children: React.ReactNode; contentStyle?: object }) {
  const theme = useTheme();
  return <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.scroll, contentStyle]}>{children}</ScrollView>;
}

export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.pageHeading}>
      <View style={styles.headingCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: theme.tint }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[styles.pageTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function PrimaryButton({ label, icon, iconColor, onPress, disabled = false, compact = false }: { label: string; icon?: IconName; iconColor?: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, compact && styles.primaryButtonCompact, { backgroundColor: theme.buttonPrimary, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 }]}>
      {icon ? <Ionicons name={icon} size={compact ? 17 : 19} color={iconColor ?? theme.text} /> : null}
      <Text style={[styles.primaryButtonText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function DateStrip({ selected, onSelect, tasks }: { selected: string; onSelect: (date: string) => void; tasks: FlowTask[] }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const locale = localeFor(settings.language);
  const selectedDate = new Date(`${selected}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index - 3));
  return (
    <View style={styles.dateStrip}>
      {days.map(date => {
        const key = dateKey(date);
        const active = selected === key;
        const hasTasks = tasks.some(task => task.date === key);
        return (
          <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onSelect(key)} style={[styles.dateCell, { backgroundColor: active ? theme.buttonPrimary : 'transparent' }]}>
            <Text style={[styles.dateWeekday, { color: active ? theme.text : theme.textSecondary }]}>{date.toLocaleDateString(locale, { weekday: 'short' })}</Text>
            <Text style={[styles.dateNumber, { color: active ? theme.text : theme.text }]}>{date.getDate()}</Text>
            <View style={[styles.dateIndicator, { backgroundColor: hasTasks ? (active ? theme.text : theme.tint) : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function TaskProgress({ tasks }: { tasks: FlowTask[] }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const done = tasks.filter(task => task.completed).length;
  const progress = tasks.length ? done / tasks.length : 0;
  return (
    <View style={[styles.progressCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.progressTop}>
        <View><Text style={[styles.eyebrow, { color: theme.textSecondary }]}>{localize(settings.language, 'DAILY PROGRESS', 'PAG-UNLAD NGAYONG ARAW')}</Text><Text style={[styles.progressCaption, { color: theme.textSecondary }]}><Text style={[styles.progressCount, { color: theme.text }]}>{done}</Text> {localize(settings.language, `of ${tasks.length} tasks completed`, `sa ${tasks.length} gawain na natapos`)}</Text></View>
        <Text style={[styles.progressPercent, { color: theme.tint }]}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.buttonSecondary }]}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.tint }]} /></View>
      <Text style={[styles.progressFoot, { color: theme.textSecondary }]}>{progress === 1
        ? localize(settings.language, 'Everything done. Take a well-earned breath.', 'Tapos na ang lahat. Magpahinga ka muna.')
        : localize(settings.language, 'You’re finding your flow. Keep it up!', 'Dahan-dahan lang. Magpatuloy sa sarili mong ritmo!')}</Text>
    </View>
  );
}

export function TaskCard({ task }: { task: FlowTask }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const locale = localeFor(settings.language);
  const { toggleTask, deleteTask } = useFlowTasks();
  const priorityColor = task.priority === 'Low' ? '#66A87D' : task.priority === 'High' ? '#D78666' : '#C49A52';
  return (
    <View style={[styles.taskCard, { backgroundColor: theme.card, borderColor: theme.border }, task.completed && { backgroundColor: theme.buttonSecondary }]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel={`${localize(settings.language, task.completed ? 'Reopen' : 'Complete', task.completed ? 'Buksan muli' : 'Kumpletuhin')} ${task.title}`} onPress={() => toggleTask(task.id)} style={[styles.taskCheck, { borderColor: task.completed ? theme.tint : theme.border, backgroundColor: task.completed ? theme.buttonPrimary : 'transparent' }]}>
        {task.completed ? <Ionicons name="checkmark" size={15} color={theme.text} /> : null}
      </Pressable>
      <View style={styles.taskBody}>
        <View style={styles.taskTitleRow}>
          <Text numberOfLines={2} style={[styles.taskTitle, { color: task.completed ? theme.textSecondary : theme.text }, task.completed && styles.strike]}>{task.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`${localize(settings.language, 'Delete', 'Burahin')} ${task.title}`} onPress={() => deleteTask(task.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.taskMeta}>
          <Ionicons name="calendar-outline" size={12} color={theme.textSecondary} /><Text style={{ color: theme.textSecondary }}>{new Date(`${task.date}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</Text>
          <Ionicons name="time-outline" size={12} color={theme.textSecondary} /><Text style={{ color: theme.textSecondary }}>{task.time}</Text>
          <Text style={{ color: theme.textSecondary }}>{task.duration} {localize(settings.language, 'min', 'min')}</Text>
        </View>
        <View style={styles.taskTags}>
          <Text style={[styles.categoryTag, { color: theme.tint, backgroundColor: theme.buttonSecondary }]}>{localize(settings.language, task.category, task.category === 'Work' ? 'Trabaho' : task.category === 'Personal' ? 'Personal' : task.category === 'Errands' ? 'Mga lakad' : task.category)}</Text>
          <View style={styles.priorityTag}><View style={[styles.priorityDot, { backgroundColor: priorityColor }]} /><Text style={{ color: theme.textSecondary }}>{localize(settings.language, `${task.priority} priority`, task.priority === 'High' ? 'Mataas na prayoridad' : task.priority === 'Medium' ? 'Katamtamang prayoridad' : 'Mababang prayoridad')}</Text></View>
          {task.mood ? <View style={styles.moodTag}><Ionicons name={MOOD_OPTIONS.find(option => option.label === task.mood)?.icon ?? 'happy-outline'} size={12} color={MOOD_OPTIONS.find(option => option.label === task.mood)?.color ?? theme.tint} /><Text style={{ color: theme.textSecondary }}>{localize(settings.language, `Mood: ${task.mood}`, `Mood: ${task.mood === 'Great' ? 'Masaya' : task.mood === 'Good' ? 'Mabuti' : task.mood === 'Okay' ? 'Ayos lang' : task.mood === 'Low' ? 'Malungkot' : 'Stress'}`)}</Text></View> : null}
        </View>
        {task.notes ? <View style={[styles.taskNotes, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}><Text style={[styles.taskNotesLabel, { color: theme.text }]}>{localize(settings.language, 'Notes', 'Mga tala')}</Text><Text style={[styles.taskNotesText, { color: theme.textSecondary }]}>{task.notes}</Text></View> : null}
      </View>
    </View>
  );
}

export function EmptyState({ title, body, icon = 'leaf-outline' }: { title: string; body: string; icon?: IconName }) {
  const theme = useTheme();
  return (
    <View style={[styles.emptyState, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.buttonSecondary }]}><Ionicons name={icon} size={23} color={theme.tint} /></View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>{body}</Text>
    </View>
  );
}

export function AddTaskSheet({ visible, initialDate, onClose }: { visible: boolean; initialDate: string; onClose: () => void }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const { addTask } = useFlowTasks();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState('');
  const [category, setCategory] = useState('Personal');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [mood, setMood] = useState<Mood | null>(null);
  const [notes, setNotes] = useState('');
  const submit = () => {
    if (!title.trim() || !date.trim() || !time.trim()) return;
    addTask({ title: title.trim(), date: date.trim(), time: time.trim(), category, priority, mood: mood ?? undefined, notes });
    setTitle('');
    setTime('');
    setDate(initialDate);
    setCategory('Personal');
    setPriority('Medium');
    setMood(null);
    setNotes('');
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close new task sheet" />
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.eyebrow, { color: theme.tint }]}>{localize(settings.language, 'NEW TASK', 'BAGONG GAWAIN')}</Text>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{localize(settings.language, 'Add a task', 'Magdagdag ng gawain')}</Text>
            <TextInput autoFocus value={title} onChangeText={setTitle} placeholder={localize(settings.language, 'What would you like to do?', 'Ano ang gusto mong gawin?')} placeholderTextColor={theme.textSecondary} style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]} />
            <View style={styles.inputRow}>
              <View style={styles.inputColumn}><Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{localize(settings.language, 'DATE', 'PETSA')}</Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.textSecondary} style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]} /></View>
              <View style={styles.inputColumn}><Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{localize(settings.language, 'START TIME', 'ORAS NG SIMULA')}</Text><TextInput value={time} onChangeText={setTime} placeholder="09:00" placeholderTextColor={theme.textSecondary} style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]} /></View>
            </View>
            <Text style={[styles.inputLabel, styles.optionLabel, { color: theme.textSecondary }]}>{localize(settings.language, 'CATEGORY', 'KATEGORYA')}</Text>
            <View style={styles.choiceRow}>
              {TASK_CATEGORIES.map(option => {
                const selected = category === option.label;
                return <Pressable key={option.label} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setCategory(option.label)} style={[styles.choiceButton, { borderColor: selected ? theme.tint : theme.border, backgroundColor: selected ? theme.buttonSecondary : theme.inputBackground }]}>
                  <Ionicons name={option.icon} size={15} color={option.color} />
                  <Text style={{ color: selected ? theme.tint : theme.textSecondary, fontSize: 9, fontWeight: '700' }}>{localize(settings.language, option.label, option.label === 'Work' ? 'Trabaho' : option.label === 'Personal' ? 'Personal' : 'Mga lakad')}</Text>
                </Pressable>;
              })}
            </View>
            <Text style={[styles.inputLabel, styles.optionLabel, { color: theme.textSecondary }]}>{localize(settings.language, 'PRIORITY', 'PRAYORIDAD')}</Text>
            <View style={styles.choiceRow}>
              {TASK_PRIORITIES.map(option => {
                const selected = priority === option.label;
                return <Pressable key={option.label} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setPriority(option.label)} style={[styles.choiceButton, { borderColor: selected ? theme.tint : theme.border, backgroundColor: selected ? theme.buttonSecondary : theme.inputBackground }]}>
                  <Ionicons name={option.icon} size={15} color={option.color} />
                  <Text style={{ color: selected ? theme.tint : theme.textSecondary, fontSize: 9, fontWeight: '700' }}>{localize(settings.language, option.label, option.label === 'Low' ? 'Mababa' : option.label === 'Medium' ? 'Katamtaman' : 'Mataas')}</Text>
                </Pressable>;
              })}
            </View>
            <Text style={[styles.inputLabel, styles.moodLabel, { color: theme.textSecondary }]}>{localize(settings.language, 'MOOD (OPTIONAL)', 'MOOD (OPSYONAL)')}</Text>
            <View style={styles.moodOptions}>
              {MOOD_OPTIONS.map(option => {
                const selected = mood === option.label;
                return <Pressable
                  key={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${option.label} mood`}
                  onPress={() => setMood(selected ? null : option.label)}
                  style={[styles.moodButton, { borderColor: selected ? theme.tint : theme.border, backgroundColor: selected ? theme.buttonSecondary : theme.inputBackground }]}
                >
                  <Ionicons name={option.icon} size={19} color={option.color} />
                  <Text style={{ color: selected ? theme.tint : theme.textSecondary, fontSize: 9, fontWeight: '700' }}>{localize(settings.language, option.label, option.label === 'Great' ? 'Masaya' : option.label === 'Good' ? 'Mabuti' : option.label === 'Okay' ? 'Ayos lang' : option.label === 'Low' ? 'Malungkot' : 'Stress')}</Text>
                </Pressable>;
              })}
            </View>
            <Text style={[styles.inputLabel, styles.notesLabel, { color: theme.textSecondary }]}>{localize(settings.language, 'NOTES (OPTIONAL)', 'TALA (OPSYONAL)')}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={localize(settings.language, 'Add a note for this task', 'Magdagdag ng tala')}
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
              style={[styles.notesInput, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={onClose} style={[styles.cancelButton, { borderColor: theme.border }]}><Text style={{ color: theme.textSecondary, fontWeight: '700' }}>{localize(settings.language, 'Cancel', 'Kanselahin')}</Text></Pressable>
              <PrimaryButton label={localize(settings.language, 'Add task', 'Magdagdag ng gawain')} icon="add" iconColor="#2D7655" onPress={submit} disabled={!title.trim() || !date.trim() || !time.trim()} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const flowStyles = StyleSheet.create({
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  muted: { fontSize: 12, lineHeight: 18 },
});

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  focusButton: { height: 34, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#BDECCF', borderWidth: 1, borderColor: '#FFFFFF' },
  avatarText: { color: '#27523A', fontSize: 12, fontWeight: '800' },
  scroll: { paddingHorizontal: 18, paddingTop: 21, paddingBottom: 26 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  headingCopy: { flex: 1 },
  eyebrow: { fontSize: 9, letterSpacing: 1.1, fontWeight: '800', marginBottom: 6 },
  pageTitle: { fontSize: 26, lineHeight: 32, letterSpacing: -0.8, fontWeight: '800' },
  subtitle: { marginTop: 6, fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 46, paddingHorizontal: 17, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonCompact: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12 },
  primaryButtonText: { fontSize: 12, fontWeight: '800' },
  dateStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, marginBottom: 15 },
  dateCell: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 13 },
  dateWeekday: { fontSize: 9, fontWeight: '700' },
  dateNumber: { fontSize: 14, fontWeight: '800' },
  dateIndicator: { width: 4, height: 4, borderRadius: 2 },
  progressCard: { padding: 15, borderWidth: 1, borderRadius: 17, marginBottom: 4 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressCaption: { fontSize: 11 },
  progressCount: { fontSize: 19, fontWeight: '800' },
  progressPercent: { fontSize: 20, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 3, marginTop: 13, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressFoot: { marginTop: 8, fontSize: 10 },
  taskCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 15, borderWidth: 1, marginBottom: 8 },
  taskCheck: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  taskBody: { flex: 1, minWidth: 0 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  taskTitle: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  strike: { textDecorationLine: 'line-through' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  taskMetaText: { fontSize: 9 },
  taskTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  moodTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskNotes: { marginTop: 8, paddingHorizontal: 9, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderRadius: 9 },
  taskNotesLabel: { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  taskNotesText: { fontSize: 11, lineHeight: 16 },
  categoryTag: { overflow: 'hidden', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: '700' },
  priorityTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priorityDot: { width: 5, height: 5, borderRadius: 3 },
  emptyState: { minHeight: 170, alignItems: 'center', justifyContent: 'center', padding: 22, borderWidth: 1, borderStyle: 'dashed', borderRadius: 17, marginTop: 8 },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontSize: 13, fontWeight: '800' },
  emptyBody: { textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 5, maxWidth: 240 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,18,14,0.48)' },
  sheet: { maxHeight: '90%', paddingHorizontal: 20, paddingTop: 11, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetContent: { paddingBottom: 4 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 15, letterSpacing: -0.5 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 13, marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputColumn: { flex: 1 },
  inputLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 },
  optionLabel: { marginTop: 2 },
  choiceRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  choiceButton: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  moodLabel: { marginTop: 2 },
  moodOptions: { flexDirection: 'row', gap: 5, marginBottom: 13 },
  moodButton: { flex: 1, minWidth: 0, minHeight: 52, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 3 },
  notesLabel: { marginTop: 1 },
  notesInput: { minHeight: 68, maxHeight: 120, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, marginBottom: 12 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5 },
  cancelButton: { minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 13 },
});
