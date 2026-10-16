import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { deleteModel } from '@/ai/local';
import { exportBackup, pickBackup, restoreBackup } from '@/backup/backup';
import { Button } from '@/components/Button';
import { Section } from '@/components/Section';
import { SmoothPressable } from '@/components/SmoothPressable';
import { clearAllConversations } from '@/db/conversations';
import { clearAllDetections } from '@/db/detections';
import { clearAllScans } from '@/db/scans';
import { getDeviceSecurityLevel } from '@/security/deviceAuthentication';
import { useSettings } from '@/settings/SettingsContext';
import type { ThemeMode } from '@/settings/storage';
import { useTheme, type Theme } from '@/theme';
import { confirmAction, showMessage } from '@/utils/confirm';

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: 'sunny-outline' | 'moon-outline' }[] = [
  { id: 'light', label: 'Light', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/** App-wide (system) settings. Detector options live in chat-settings.tsx. */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update, reset } = useSettings();
  const [nicknameDraft, setNicknameDraft] = useState(settings.nickname);
  const [busy, setBusy] = useState(false);
  const [checkingAppLock, setCheckingAppLock] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);

  const run = async (job: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ text: await job(), error: false });
    } catch (e) {
      setStatus({
        text: e instanceof Error ? e.message : 'Something went wrong.',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const backup = () =>
    run(async () => `Backup created (${await exportBackup(settings)} messages).`);

  const setAppLockEnabled = async (enabled: boolean) => {
    if (checkingAppLock) return;
    if (Platform.OS !== 'android') {
      showMessage('Android only', 'App lock is available on Android devices.');
      return;
    }

    setCheckingAppLock(true);
    try {
      if (!enabled) {
        await update('appLockEnabled', false);
        return;
      }
      const level = await getDeviceSecurityLevel();
      if (level === 0) {
        showMessage(
          'Screen lock required',
          'Set up a PIN, pattern, password, fingerprint, or face unlock in your phone settings before enabling app lock.'
        );
        return;
      }
      await update('appLockEnabled', true);
    } catch (error) {
      showMessage(
        'Could not change app lock',
        error instanceof Error ? error.message : 'Check your phone’s security settings and try again.'
      );
    } finally {
      setCheckingAppLock(false);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const b = await pickBackup();
      setBusy(false);
      if (!b) return; // picker cancelled
      confirmAction(
        'Restore backup?',
        `This replaces your current chat and settings with the backup from ${new Date(b.createdAt).toLocaleString()} (${b.messages.length} messages).`,
        'Restore',
        () =>
          void (async () => {
            setBusy(true);
            try {
              await restoreBackup(b, update);
              setNicknameDraft(b.settings.nickname ?? '');
              setStatus({ text: 'Backup restored.', error: false });
            } catch (e) {
              setStatus({
                text: e instanceof Error ? e.message : 'Restore failed.',
                error: true,
              });
            } finally {
              setBusy(false);
            }
          })()
      );
    } catch (e) {
      setStatus({
        text: e instanceof Error ? e.message : 'Something went wrong.',
        error: true,
      });
      setBusy(false);
    }
  };

  const resetAllData = () =>
    confirmAction(
      'Reset all data?',
      'This deletes your scans, nickname, settings, API key and the downloaded local model. The app will start again from onboarding.',
      'Reset',
      async () => {
        await clearAllConversations();
        await clearAllDetections();
        await clearAllScans();
        await deleteModel();
        // Settings go back to defaults (onboarded = false), so the root
        // layout switches to the onboarding screen.
        await reset();
      }
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Section title="Profile" theme={theme}>
        <Text style={[styles.label, { color: theme.text }]}>Nickname</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          accessibilityLabel="Nickname"
          value={nicknameDraft}
          onChangeText={setNicknameDraft}
          onBlur={() => update('nickname', nicknameDraft.trim())}
          maxLength={30}
          placeholder="Your nickname"
          placeholderTextColor={theme.textSecondary}
        />
      </Section>

      <Section title="Appearance" theme={theme}>
        <View
          style={styles.segmented}
        >
          {THEME_OPTIONS.map((o) => {
            const active = settings.theme === o.id;
            return (
              <SmoothPressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityLabel={`${o.label} appearance`}
                accessibilityState={{ checked: active }}
                onPress={() => update('theme', o.id)}
                style={[
                  styles.segment,
                  {
                    backgroundColor: active ? theme.buttonPrimary : theme.buttonSecondary,
                  },
                ]}
              >
                <Ionicons
                  name={o.icon}
                  size={16}
                  color={active ? '#FFFFFF' : theme.textSecondary}
                />
                <Text
                  style={{
                    color: active ? '#FFFFFF' : theme.textSecondary,
                    fontWeight: active ? '700' : '400',
                  }}
                >
                  {o.label}
                </Text>
              </SmoothPressable>
            );
          })}
        </View>
      </Section>

      <Section title="Security" theme={theme}>
        <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 12 }}>
          Require your phone’s screen lock to open Maalam and return to it after leaving. Android uses biometrics when available and falls back to your PIN, pattern, or password.
        </Text>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
              Lock when leaving app
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
              Face, fingerprint, PIN, pattern, or password
            </Text>
          </View>
          <Switch
            accessibilityLabel="Lock when leaving app"
            value={settings.appLockEnabled}
            onValueChange={(val) => void setAppLockEnabled(val)}
            disabled={Platform.OS !== 'android' || checkingAppLock}
            trackColor={{ false: theme.border, true: theme.buttonPrimary }}
          />
        </View>

        {settings.appLockEnabled && (
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.label, { color: theme.text, fontSize: 13, marginBottom: 6 }]}>
              Require authentication
            </Text>
            <View style={styles.segmented}>
              {(
                [
                  { id: 'immediate', label: 'Immediately' },
                  { id: '1m', label: 'After 1 min' },
                  { id: '5m', label: 'After 5 min' },
                ] as const
              ).map((t) => {
                const active = settings.appLockTimeout === t.id;
                return (
                  <SmoothPressable
                    key={t.id}
                    accessibilityRole="radio"
                    accessibilityLabel={t.label}
                    accessibilityState={{ checked: active }}
                    onPress={() => update('appLockTimeout', t.id)}
                    style={[
                      styles.segment,
                      {
                        backgroundColor: active ? theme.buttonPrimary : theme.buttonSecondary,
                        minHeight: 40,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? '#FFFFFF' : theme.textSecondary,
                        fontWeight: active ? '700' : '400',
                        fontSize: 13,
                      }}
                    >
                      {t.label}
                    </Text>
                  </SmoothPressable>
                );
              })}
            </View>
          </View>
        )}
      </Section>

      <Section title="Data" theme={theme}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Save your scans and settings to a file, or restore them later. Your
          Gemini API key and the downloaded local model are not included.
        </Text>
        <Button label="Back up data" icon="cloud-upload-outline" onPress={backup} disabled={busy} style={{ marginTop: 12 }} />
        <Button label="Restore from backup" icon="cloud-download-outline" variant="secondary" onPress={restore} disabled={busy} style={{ marginTop: 10 }} />
        {status && (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: status.error ? theme.danger : theme.success,
              marginTop: 8,
            }}
          >
            {status.text}
          </Text>
        )}
      </Section>

      <Section title="About" theme={theme}>
        <Row label="App" value={Constants.expoConfig?.name ?? '-'} theme={theme} />
        <Row label="Version" value={Constants.expoConfig?.version ?? '-'} theme={theme} />
        <LinkRow
          label="Privacy Policy"
          onPress={() => router.push('/privacy' as Href)}
          theme={theme}
        />
        <LinkRow
          label="Terms & Conditions"
          onPress={() => router.push('/terms' as Href)}
          theme={theme}
        />
      </Section>

      <Button label="Reset all data" icon="trash-outline" variant="destructiveSecondary" onPress={resetAllData} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

function Row({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: theme.text, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{value}</Text>
    </View>
  );
}

/** Tappable row that navigates to another screen. */
function LinkRow({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <SmoothPressable onPress={onPress} accessibilityRole="link" style={[styles.row, styles.linkRow, { backgroundColor: theme.background }]}>
      <Text style={{ color: theme.text, fontSize: 15 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  segmented: {
    flexDirection: 'row',
    gap: 10,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    minHeight: 48,
    paddingVertical: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  linkRow: { minHeight: 48, alignItems: 'center', marginTop: 5, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10 },
});
