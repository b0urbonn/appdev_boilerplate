import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlowText as Text } from '@/components/FlowText';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

const SLIDES = [
  { icon: 'flash-outline' as const, eyebrow: 'YOUR CALMER WORKDAY', title: 'Welcome to FlowTask.', body: 'A little more focus. A lot less overwhelm. Let’s make room for what matters.' },
  { icon: 'calendar-clear-outline' as const, eyebrow: 'A CLEARER PICTURE', title: 'See your week at a glance.', body: 'Bring your tasks, plans, and priorities together in one thoughtfully simple space.' },
  { icon: 'sparkles-outline' as const, eyebrow: 'A LITTLE EXTRA CLARITY', title: 'Meet your AI planner.', body: 'Turn a busy list into a balanced plan, with a helpful nudge whenever you need one.' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState(settings.nickname);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const isNameStep = step === SLIDES.length;
  const trimmed = nickname.trim();
  const [animation] = useState(() => new Animated.Value(1));

  useEffect(() => {
    animation.setValue(0);
    Animated.timing(animation, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [animation, step]);

  const finish = async (allowEmptyName = false) => {
    if (saving || (isNameStep && !allowEmptyName && !trimmed)) return;
    setSaving(true);
    setSaveError('');
    try {
      await update('nickname', trimmed);
      await update('onboarded', true);
    } catch (error) {
      console.warn('Unable to finish onboarding:', error);
      setSaveError('Unable to save your setup. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const skip = () => {
    if (saving) return;
    if (isNameStep) {
      void finish(true);
      return;
    }
    setStep(SLIDES.length);
  };
  const advance = () => {
    if (isNameStep) void finish();
    else setStep(value => value + 1);
  };
  const slide = SLIDES[Math.min(step, SLIDES.length - 1)];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <View style={styles.brand}><View style={styles.logo}><Ionicons name="flash" size={18} color="#173B2A" /></View><View><Text style={[styles.brandTitle, { color: theme.text }]}>FlowTask</Text><Text style={[styles.brandCaption, { color: theme.textSecondary }]}>Make room for what matters</Text></View></View>
          <SmoothPressable accessibilityRole="button" disabled={saving} onPress={skip} hitSlop={10}><Text style={[styles.skip, { color: theme.textSecondary }]}>{saving ? 'Saving…' : 'Skip'}</Text></SmoothPressable>
        </View>
        <Animated.View style={[styles.body, { opacity: animation, transform: [{ translateX: animation.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
          <View style={[styles.iconTile, { backgroundColor: theme.buttonPrimary }]}><Ionicons name={isNameStep ? 'person-outline' : slide.icon} size={34} color={theme.text} /></View>
          <Text style={[styles.eyebrow, { color: theme.tint }]}>{isNameStep ? 'ONE LAST THING' : slide.eyebrow}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{isNameStep ? 'What should we call you?' : slide.title}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{isNameStep ? 'Your planner will use your name to make things feel a little more personal.' : slide.body}</Text>
          {isNameStep ? <TextInput autoFocus value={nickname} onChangeText={setNickname} onSubmitEditing={() => void finish()} maxLength={32} returnKeyType="done" placeholder="Your name" placeholderTextColor={theme.textSecondary} style={[styles.nameInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]} /> : null}
          {saveError ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{saveError}</Text> : null}
        </Animated.View>
        <View style={styles.footer}>
          <View accessibilityLabel={`Step ${step + 1} of 4`} style={styles.progress}>
            {SLIDES.map((_, index) => <View key={index} style={[styles.dot, { backgroundColor: index === step ? theme.tint : index < step ? theme.buttonPrimary : theme.border }, index === step && styles.currentDot]} />)}
            <View style={[styles.dot, { backgroundColor: step === SLIDES.length ? theme.tint : theme.border }, step === SLIDES.length && styles.currentDot]} />
          </View>
          <SmoothPressable accessibilityRole="button" disabled={saving || (isNameStep && !trimmed)} onPress={advance} style={({ pressed }) => [styles.nextButton, { backgroundColor: theme.buttonPrimary, opacity: saving || (isNameStep && !trimmed) ? 0.45 : pressed ? 0.82 : 1 }]}>
            <Text style={[styles.nextText, { color: theme.text }]}>{saving ? 'Saving…' : isNameStep ? 'Get started' : 'Next'}</Text>{!saving ? <Ionicons name="arrow-forward" size={17} color={theme.text} /> : null}
          </SmoothPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8BE0B8' },
  brandTitle: { fontSize: 14, fontWeight: '800' },
  brandCaption: { fontSize: 9, marginTop: 2 },
  skip: { fontSize: 11, fontWeight: '700', padding: 8 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  iconTile: { width: 94, height: 94, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 27, shadowColor: '#409A6B', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  title: { maxWidth: 310, textAlign: 'center', fontSize: 27, lineHeight: 34, letterSpacing: -0.8, fontWeight: '800' },
  description: { maxWidth: 290, textAlign: 'center', fontSize: 12, lineHeight: 20, marginTop: 11 },
  nameInput: { width: '100%', maxWidth: 285, height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 12, marginTop: 18 },
  error: { marginTop: 10, fontSize: 11, textAlign: 'center' },
  footer: { gap: 18 },
  progress: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  currentDot: { width: 20 },
  nextButton: { width: '100%', minHeight: 49, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextText: { fontSize: 12, fontWeight: '800' },
});
