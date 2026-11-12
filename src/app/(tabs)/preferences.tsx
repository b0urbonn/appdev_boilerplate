import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { DeviceEventEmitter, Platform, StyleSheet, Switch, TextInput, View } from 'react-native';
import { FlowTaskPage, PageHeading, ScreenScroll } from '@/components/FlowTaskUI';
import { FlowText as Text } from '@/components/FlowText';
import { TapPressable as Pressable } from '@/components/TapPressable';
import { localize, localeFor } from '@/i18n';
import { playTapSound } from '@/components/tapSound';
import { useSettings } from '@/settings/SettingsContext';
import { useFlowTasks } from '@/tasks/FlowTasksContext';
import { useTheme } from '@/theme';
import { cancelDailyTaskReminder, scheduleDailyTaskReminder } from '@/utils/dailyReminder';
import { confirmAction, showMessage } from '@/utils/confirm';

export default function PreferencesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const locale = localeFor(settings.language);
  const { resetSampleTasks } = useFlowTasks();
  const [name, setName] = useState(settings.nickname);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  const saveName = async () => {
    try {
      await update('nickname', name.trim());
      showMessage(localize(settings.language, 'Profile updated', 'Na-update ang profile'), localize(settings.language, 'Your display name has been saved.', 'Na-save na ang pangalan mo.'));
    } catch (error) {
      showMessage(localize(settings.language, 'Unable to save profile', 'Hindi ma-save ang profile'), error instanceof Error ? error.message : localize(settings.language, 'Please try again.', 'Subukan muli.'));
    }
  };
  const resetTasks = () => confirmAction(localize(settings.language, 'Reset sample tasks?', 'Ibalik ang mga halimbawang gawain?'), localize(settings.language, 'This replaces your current task list with the original FlowTask examples.', 'Papalitan nito ang kasalukuyang listahan mo ng mga orihinal na halimbawa ng FlowTask.'), localize(settings.language, 'Reset', 'Ibalik'), resetSampleTasks);
  const setDailyReminders = async (enabled: boolean) => {
    try {
      if (enabled) await scheduleDailyTaskReminder(settings.reminderTime);
      else await cancelDailyTaskReminder();
      await update('dailyReminders', enabled);
    } catch (error) {
      showMessage('Unable to update daily reminders', error instanceof Error ? error.message : 'Please try again.');
    }
  };
  const setReminderTime = async (time: string) => {
    try {
      if (settings.dailyReminders) await scheduleDailyTaskReminder(time);
      await update('reminderTime', time);
    } catch (error) {
      showMessage('Unable to update reminder time', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <FlowTaskPage onProfilePress={() => router.navigate('/preferences' as Href)}>
      <ScreenScroll>
        <PageHeading eyebrow={localize(settings.language, 'MAKE IT YOURS', 'IANGKOP SA IYO')} title={localize(settings.language, 'Settings', 'Mga Setting')} subtitle={localize(settings.language, 'A space that feels like you.', 'Isang espasyong para sa iyo.')} />
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <CardHeading icon="person-outline" title={localize(settings.language, 'Your profile', 'Iyong profile')} subtitle={localize(settings.language, 'How should we say hello?', 'Anong pangalan ang itatawag namin sa iyo?')} />
          <Text style={[styles.label, { color: theme.textSecondary }]}>{localize(settings.language, 'DISPLAY NAME', 'PANGALAN')}</Text>
          <View style={styles.nameRow}>
            <TextInput value={name} onChangeText={setName} onSubmitEditing={() => void saveName()} onBlur={() => { if (name.trim() !== settings.nickname) void saveName(); }} maxLength={32} placeholder={localize(settings.language, 'Your name', 'Iyong pangalan')} placeholderTextColor={theme.textSecondary} style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Save display name" onPress={() => void saveName()} style={[styles.saveButton, { backgroundColor: theme.buttonPrimary }]}><Ionicons name="checkmark" size={18} color={theme.text} /></Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <CardHeading icon="language-outline" title={localize(settings.language, 'Language', 'Wika')} subtitle={localize(settings.language, 'Choose English or Tagalog.', 'Pumili ng English o Tagalog.')} />
          <View style={styles.appearanceRow}>{([
            { value: 'en', label: 'English' },
            { value: 'tl', label: 'Tagalog' },
          ] as const).map(option => {
            const active = settings.language === option.value;
            return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => update('language', option.value).catch(error => showMessage('Unable to change language', error instanceof Error ? error.message : 'Please try again.'))} style={[styles.appearanceButton, { backgroundColor: active ? theme.buttonSecondary : theme.background, borderColor: active ? theme.tint : theme.border }]}>
              <Text style={{ color: active ? theme.tint : theme.textSecondary, fontSize: 10, fontWeight: '700' }}>{option.label}</Text>
            </Pressable>;
          })}</View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <CardHeading icon="sunny-outline" title={localize(settings.language, 'Appearance', 'Hitsura')} subtitle={localize(settings.language, 'Choose your preferred look.', 'Piliin ang gusto mong itsura.')} />
          <View style={styles.appearanceRow}>{(['light', 'dark'] as const).map(mode => {
            const active = settings.theme === mode;
            return <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => update('theme', mode).catch(error => showMessage('Unable to change appearance', error instanceof Error ? error.message : 'Please try again.'))} style={[styles.appearanceButton, { backgroundColor: active ? theme.buttonSecondary : theme.background, borderColor: active ? theme.tint : theme.border }]}>
              <Ionicons name={mode === 'light' ? 'sunny-outline' : 'moon-outline'} size={16} color={active ? theme.tint : theme.textSecondary} /><Text style={{ color: active ? theme.tint : theme.textSecondary, fontSize: 10, fontWeight: '700' }}>{mode === 'light' ? localize(settings.language, 'Light', 'Maliwanag') : localize(settings.language, 'Dark', 'Madilim')}</Text>
            </Pressable>;
          })}</View>
        </View>

        <View style={[styles.card, styles.preferencesCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <CardHeading icon="options-outline" title={localize(settings.language, 'Your preferences', 'Mga kagustuhan')} subtitle={localize(settings.language, 'Only the nudges you want.', 'Piliin lang ang mga paalala na gusto mo.')} />
          {Platform.OS === 'android' ? <>
            <PreferenceRow icon="notifications-outline" label={localize(settings.language, 'Daily reminders', 'Pang-araw-araw na paalala')} value={settings.dailyReminders} onChange={setDailyReminders} />
            {settings.dailyReminders ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`${localize(settings.language, 'Choose daily reminder time, currently', 'Pumili ng oras ng paalala, kasalukuyang')} ${formatReminderTime(settings.reminderTime, locale)}`} onPress={() => setTimePickerVisible(true)} style={[styles.reminderTimeRow, { borderBottomColor: theme.border }]}>
                <Ionicons name="time-outline" size={17} color={theme.textSecondary} />
                <Text style={[styles.preferenceLabel, { color: theme.text }]}>{localize(settings.language, 'Reminder time', 'Oras ng paalala')}</Text>
                <Text style={{ color: theme.tint, fontSize: 10, fontWeight: '800' }}>{formatReminderTime(settings.reminderTime, locale)}</Text>
              </Pressable>
            ) : null}
            {timePickerVisible ? <DateTimePicker mode="time" display="default" value={dateFromTime(settings.reminderTime)} onChange={(event, date) => {
              setTimePickerVisible(false);
              if (event.type === 'set' && date) void setReminderTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
            }} /> : null}
          </> : null}
          <PreferenceRow icon="volume-medium-outline" label={localize(settings.language, 'Sounds', 'Mga tunog')} value={settings.soundEffects} onChange={value => {
            update('soundEffects', value).catch(error => showMessage('Unable to save sound preference', error instanceof Error ? error.message : 'Please try again.'));
          }} />
          <PreferenceRow icon="bar-chart-outline" label={localize(settings.language, 'Weekly summary', 'Buod kada linggo')} value={weeklySummary} onChange={setWeeklySummary} last />
        </View>
        <Pressable accessibilityRole="button" onPress={() => DeviceEventEmitter.emit('flowtask:replay-tutorial')} style={[styles.tutorialButton, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Ionicons name="help-circle-outline" size={17} color={theme.tint} />
          <Text style={{ color: theme.tint, fontSize: 11, fontWeight: '800' }}>{localize(settings.language, 'Replay tutorial', 'Ulitin ang gabay')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={resetTasks} style={[styles.resetButton, { borderColor: theme.danger, backgroundColor: theme.card }]}><Ionicons name="trash-outline" size={17} color={theme.danger} /><Text style={{ color: theme.danger, fontSize: 11, fontWeight: '800' }}>{localize(settings.language, 'Reset Sample Tasks', 'Ibalik ang mga halimbawang gawain')}</Text></Pressable>
      </ScreenScroll>
    </FlowTaskPage>
  );
}

function CardHeading({ icon, title, subtitle }: { icon: 'person-outline' | 'sunny-outline' | 'options-outline' | 'language-outline'; title: string; subtitle: string }) {
  const theme = useTheme();
  return <View style={styles.cardHeading}><View style={[styles.cardIcon, { backgroundColor: theme.buttonSecondary }]}><Ionicons name={icon} size={17} color={theme.tint} /></View><View><Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text></View></View>;
}

function PreferenceRow({ icon, label, value, onChange, last = false }: { icon: 'notifications-outline' | 'volume-medium-outline' | 'bar-chart-outline'; label: string; value: boolean; onChange: (value: boolean) => void; last?: boolean }) {
  const theme = useTheme();
  return <View style={[styles.preferenceRow, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}><Ionicons name={icon} size={17} color={theme.textSecondary} /><Text style={[styles.preferenceLabel, { color: theme.text }]}>{label}</Text><Switch value={value} accessibilityLabel={`${label} ${value ? 'on' : 'off'}`} onValueChange={next => { playTapSound(); onChange(next); }} trackColor={{ false: theme.border, true: theme.buttonPrimary }} thumbColor="#FFFFFF" /></View>;
}

function dateFromTime(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function formatReminderTime(time: string, locale: string) {
  return dateFromTime(time).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13 },
  cardIcon: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 11, fontWeight: '800' },
  cardSubtitle: { fontSize: 9, marginTop: 3 },
  label: { fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  input: { flex: 1, height: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 11 },
  saveButton: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  appearanceRow: { flexDirection: 'row', gap: 7 },
  appearanceButton: { flex: 1, minHeight: 36, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  preferencesCard: { paddingBottom: 1 },
  preferenceRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9 },
  reminderTimeRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  preferenceLabel: { flex: 1, fontSize: 10, fontWeight: '700' },
  resetButton: { minHeight: 46, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 1 },
  tutorialButton: { minHeight: 42, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 9 },
});
