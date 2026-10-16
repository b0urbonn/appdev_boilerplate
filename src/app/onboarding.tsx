import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPicker } from '@/components/AppPicker';
import { Button } from '@/components/Button';
import {
  isMonitorServiceEnabled,
  openAccessibilitySettings,
  supportsScreenshots,
} from '@/monitor/native';
import { useSettings } from '@/settings/SettingsContext';
import type { MonitoredApp } from '@/settings/storage';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Intro slides. Edit, add or remove entries to change the onboarding. */
const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Welcome to Maalam',
    body: 'Check if an image is a deepfake and scan text or audio for harmful content — right from your phone.',
  },
  {
    icon: 'scan-outline',
    title: 'Detect deepfakes',
    body: 'Attach a photo and Maalam inspects it for AI-generation and manipulation artifacts, then gives you a verdict.',
  },
  {
    icon: 'warning-outline',
    title: 'Spot harmful content',
    body: 'Paste a message or record a voice clip to flag hate speech, threats, scams and other harmful content.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'Private by design',
    body: 'Your scans stay on this device. Use Gemini in the cloud, or download Gemma to analyze fully offline.',
  },
];

// Every platform gets "choose apps to protect" and "turn on protection"
// steps; on web they double as a preview of the monitor feature.
const EXTRA_STEPS = 3;

export default function OnboardingScreen() {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState(settings.nickname);
  const [picked, setPicked] = useState<MonitoredApp[]>(settings.monitoredApps);
  const [serviceOn, setServiceOn] = useState(false);

  const isNicknameStep = step === SLIDES.length;
  const isAppsStep = step === SLIDES.length + 1;
  const isProtectionStep = step === SLIDES.length + 2;
  const trimmed = nickname.trim();

  // Re-check the accessibility toggle when the user returns from Settings.
  useEffect(() => {
    if (!isProtectionStep) return;
    const refresh = () => setServiceOn(isMonitorServiceEnabled());
    // Async so the initial read doesn't set state synchronously in the effect.
    const timer = setTimeout(refresh, 0);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setServiceOn(isMonitorServiceEnabled());
    });
    return () => { clearTimeout(timer); sub.remove(); };
  }, [isProtectionStep]);

  const finish = () => {
    update('nickname', trimmed);
    update('monitoredApps', picked);
    // Flipping this flag makes the root layout switch to the main app.
    update('onboarded', true);
  };

  const next = () => {
    // Drop the nickname keyboard so it can't cover the footer on later steps.
    if (isNicknameStep) Keyboard.dismiss();
    setStep(step + 1);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={isAppsStep ? styles.pickerContent : styles.content}>
          {isNicknameStep ? (
            <>
              <Ionicons name="person-circle-outline" size={88} color={theme.tint} />
              <Text style={[styles.title, { color: theme.text }]}>
                What should we call you?
              </Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>
                Pick a nickname. You can change it later in Settings.
              </Text>
              <TextInput
                accessibilityLabel="Nickname"
                value={nickname}
                onChangeText={setNickname}
                placeholder="Your nickname"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={() => trimmed && next()}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                  },
                ]}
              />
            </>
          ) : isAppsStep ? (
            <>
              <Text style={[styles.title, { color: theme.text }]}>
                Choose apps to protect
              </Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>
                Maalam watches these apps in the background and warns you when it spots a deepfake, AI-generated or harmful content.
              </Text>
              <AppPicker selected={picked} onChange={setPicked} />
            </>
          ) : isProtectionStep ? (
            <>
              <Ionicons
                name={serviceOn ? 'shield-checkmark' : 'shield-half-outline'}
                size={88}
                color={serviceOn ? theme.success : theme.tint}
              />
              <Text style={[styles.title, { color: theme.text }]}>
                Turn on protection
              </Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>
                Maalam uses an Accessibility service to see which protected app is open and capture its screen when it changes.
                {supportsScreenshots()
                  ? ' It only analyses the apps you picked.'
                  : ' Image scanning needs Android 11 or later; on this device Maalam checks visible text instead.'}
              </Text>
              <Button
                label={serviceOn ? 'Protection is on' : 'Open Accessibility settings'}
                icon={serviceOn ? 'checkmark-circle-outline' : 'settings-outline'}
                disabled={serviceOn}
                onPress={() => {
                  openAccessibilitySettings();
                  // Web has no system settings screen to return from; the
                  // stub flips the flag synchronously.
                  setServiceOn(isMonitorServiceEnabled());
                }}
              />
            </>
          ) : (
            <>
              <Ionicons name={SLIDES[step].icon} size={88} color={theme.tint} />
              <Text style={[styles.title, { color: theme.text }]}>
                {SLIDES[step].title}
              </Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>
                {SLIDES[step].body}
              </Text>
            </>
          )}
        </View>

        <View style={styles.dots}>
          {Array.from({ length: SLIDES.length + EXTRA_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === step ? theme.tint : theme.border },
              ]}
            />
          ))}
        </View>

        <View style={styles.footer}>
          {isAppsStep ? (
            <>
              <Button label="Skip for now" variant="secondary" onPress={next} />
              <Button label="Next" disabled={picked.length === 0} onPress={next} />
            </>
          ) : isProtectionStep ? (
            <>
              <Button label="Later" variant="secondary" onPress={finish} />
              <Button label="Get started" onPress={finish} />
            </>
          ) : (
            <>
              <Button label={step > 0 ? 'Back' : 'Skip'} variant="secondary" onPress={() => setStep(step > 0 ? step - 1 : SLIDES.length)} />
              <Button
                label="Next"
                disabled={isNicknameStep && !trimmed}
                onPress={next}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  pickerContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    gap: 12,
  },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    marginTop: 8,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
