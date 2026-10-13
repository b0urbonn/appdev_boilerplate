import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Intro slides. Edit, add or remove entries to change the onboarding. */
const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'sparkles-outline',
    title: 'Welcome',
    body: 'A starter app with an AI assistant built in. Make it your own.',
  },
  {
    icon: 'cloud-offline-outline',
    title: 'Offline first',
    body: 'Your chats are saved on this phone and work without internet.',
  },
  {
    icon: 'hardware-chip-outline',
    title: 'Cloud or on-device AI',
    body: 'Use Gemini with a free API key, or download Gemma to run AI fully on your phone.',
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState(settings.nickname);

  const isNicknameStep = step === SLIDES.length;
  const trimmed = nickname.trim();

  const finish = () => {
    update('nickname', trimmed);
    // Flipping this flag makes the root layout switch to the main app.
    update('onboarded', true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.content}>
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
                value={nickname}
                onChangeText={setNickname}
                placeholder="Your nickname"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={() => trimmed && finish()}
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
          {[...SLIDES, null].map((_, i) => (
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
          {step > 0 ? (
            <Pressable onPress={() => setStep(step - 1)} style={styles.secondary}>
              <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Back</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setStep(SLIDES.length)} style={styles.secondary}>
              <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Skip</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={isNicknameStep && !trimmed}
            onPress={() => (isNicknameStep ? finish() : setStep(step + 1))}
            style={[
              styles.primary,
              {
                backgroundColor: theme.tint,
                opacity: isNicknameStep && !trimmed ? 0.4 : 1,
              },
            ]}
          >
            <Text style={styles.primaryText}>
              {isNicknameStep ? 'Get started' : 'Next'}
            </Text>
          </Pressable>
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
  secondary: { paddingVertical: 14, paddingHorizontal: 12 },
  primary: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
