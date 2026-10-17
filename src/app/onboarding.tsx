import Ionicons from '@expo/vector-icons/Ionicons';
import { Asset } from 'expo-asset';
import React, { useEffect, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPicker } from '@/components/AppPicker';
import { Button } from '@/components/Button';
import { AVATAR_OPTIONS, ProfileAvatar } from '@/components/ProfileAvatar';
import { SmoothPressable } from '@/components/SmoothPressable';
import { ONBOARDING_IMAGES } from '@/generated/onboardingImages';
import {
  openAccessibilitySettings,
  supportsScreenshots,
} from '@/monitor/native';
import { useMonitorService } from '@/monitor/useMonitorService';
import { useSettings } from '@/settings/SettingsContext';
import type { MonitoredApp } from '@/settings/storage';
import { useTheme } from '@/theme';

/** Intro slides. Edit, add or remove entries to change the onboarding. */
const SLIDES: { image: number; title: string; body: string }[] = [
  {
    image: ONBOARDING_IMAGES[0],
    title: 'Welcome to Maalam',
    body: 'Check if an image is a deepfake and scan text or audio for harmful content — right from your phone.',
  },
  {
    image: ONBOARDING_IMAGES[1],
    title: 'Detect deepfakes',
    body: 'Attach a photo and Maalam inspects it for AI-generation and manipulation artifacts, then gives you a verdict.',
  },
  {
    image: ONBOARDING_IMAGES[2],
    title: 'Spot harmful content',
    body: 'Paste a message or record a voice clip to flag hate speech, threats, scams and other harmful content.',
  },
  {
    image: ONBOARDING_IMAGES[3],
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
  const [cachedSlideImages, setCachedSlideImages] = useState<Record<number, ImageSourcePropType>>({});
  const [nickname, setNickname] = useState(settings.nickname);
  const [avatar, setAvatar] = useState(settings.profileAvatar);
  const [picked, setPicked] = useState<MonitoredApp[]>(settings.monitoredApps);
  const { enabled: serviceOn, connected } = useMonitorService();

  // Fetch later illustrations while the first slide is on screen. The original
  // require() remains the fallback if preloading fails or the cache is cleared.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;

    SLIDES.slice(1).forEach((slide, offset) => {
      const index = offset + 1;
      const asset = Asset.fromModule(slide.image);
      if (asset.uri.startsWith('file:///android_res/')) return;

      void asset.downloadAsync()
        .then(() => {
          if (!cancelled && asset.localUri) {
            setCachedSlideImages((previous) => previous[index]
              ? previous
              : { ...previous, [index]: { uri: asset.localUri! } });
          }
        })
        .catch((error) => {
          console.warn(`Unable to preload onboarding image "${slide.title}":`, error);
        });
    });

    return () => { cancelled = true; };
  }, []);

  const isNicknameStep = step === SLIDES.length;
  const isAppsStep = step === SLIDES.length + 1;
  const isProtectionStep = step === SLIDES.length + 2;
  const trimmed = nickname.trim();

  const finish = () => {
    update('nickname', trimmed);
    update('profileAvatar', avatar);
    update('monitoredApps', picked);
    if (!settings.joinedAt) update('joinedAt', Date.now());
    // Flipping this flag makes the root layout switch to the main app.
    update('onboarded', true);
  };

  const next = () => {
    // Drop the nickname keyboard so it can't cover the footer on later steps.
    if (isNicknameStep) Keyboard.dismiss();
    setStep(step + 1);
  };

  const shuffleAvatar = () => {
    const choices = AVATAR_OPTIONS.filter((opt) => opt.id !== avatar);
    const nextAvatar = choices[Math.floor(Math.random() * choices.length)];
    if (nextAvatar) setAvatar(nextAvatar.id);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={isAppsStep ? styles.pickerContent : styles.content}>
          {isNicknameStep ? (
            <>
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel="Shuffle to a new avatar"
                onPress={shuffleAvatar}
                style={({ pressed }) => [styles.avatarWrap, { opacity: pressed ? 0.75 : 1 }]}
              >
                <ProfileAvatar avatarId={avatar} size={88} />
                <View
                  style={[
                    styles.avatarShuffleBadge,
                    { backgroundColor: theme.buttonPrimary, borderColor: theme.background },
                  ]}
                >
                  <Ionicons name="shuffle" size={14} color="#FFFFFF" />
                </View>
              </SmoothPressable>
              <Text style={[styles.title, { color: theme.text }]}>
                What should we call you?
              </Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>
                Pick a nickname.
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
                label={serviceOn ? connected ? 'Accessibility is on' : 'Accessibility enabled · reconnect' : 'Open Accessibility settings'}
                icon={serviceOn ? 'checkmark-circle-outline' : 'settings-outline'}
                disabled={serviceOn && connected}
                onPress={openAccessibilitySettings}
              />
            </>
          ) : (
            <>
              <Image
                source={cachedSlideImages[step] ?? SLIDES[step].image}
                style={styles.slideImage}
                resizeMode="contain"
                fadeDuration={0}
                accessibilityLabel={SLIDES[step].title}
              />
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
  slideImage: { width: '100%', maxWidth: 320, height: 200 },
  avatarWrap: { width: 88, height: 88, position: 'relative' },
  avatarShuffleBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
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
