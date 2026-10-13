import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteModel } from '@/ai/local';
import { exportBackup, pickBackup, restoreBackup } from '@/backup/backup';
import { Section } from '@/components/Section';
import { clearAllConversations } from '@/db/conversations';
import { useSettings } from '@/settings/SettingsContext';
import type { ThemeMode } from '@/settings/storage';
import { useTheme, type Theme } from '@/theme';
import { confirmAction } from '@/utils/confirm';

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: 'sunny-outline' | 'moon-outline' }[] = [
  { id: 'light', label: 'Light', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/** App-wide (system) settings. Chatbot options live in chat-settings.tsx. */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update, reset } = useSettings();
  const [nicknameDraft, setNicknameDraft] = useState(settings.nickname);
  const [busy, setBusy] = useState(false);
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
      'This deletes your chat, nickname, settings, API key and the downloaded local model. The app will start again from onboarding.',
      'Reset',
      async () => {
        await clearAllConversations();
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
          style={[styles.segmented, { backgroundColor: theme.inputBackground }]}
        >
          {THEME_OPTIONS.map((o) => {
            const active = settings.theme === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => update('theme', o.id)}
                style={[
                  styles.segment,
                  {
                    backgroundColor: active
                      ? theme.background === '#0E0E12'
                        ? theme.border
                        : theme.card
                      : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name={o.icon}
                  size={16}
                  color={active ? theme.tint : theme.textSecondary}
                />
                <Text
                  style={{
                    color: active ? theme.text : theme.textSecondary,
                    fontWeight: active ? '700' : '400',
                  }}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Data" theme={theme}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          Save your chat and settings to a file, or restore them later. Your
          Gemini API key and the downloaded local model are not included.
        </Text>
        <Pressable
          onPress={backup}
          disabled={busy}
          style={[styles.button, { borderColor: theme.tint }, busy && styles.faded]}
        >
          <View style={styles.buttonRow}>
            <Ionicons name="cloud-upload-outline" size={18} color={theme.tint} />
            <Text style={{ color: theme.tint, fontWeight: '600' }}>Back up data</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={restore}
          disabled={busy}
          style={[styles.button, { borderColor: theme.tint }, busy && styles.faded]}
        >
          <View style={styles.buttonRow}>
            <Ionicons name="cloud-download-outline" size={18} color={theme.tint} />
            <Text style={{ color: theme.tint, fontWeight: '600' }}>
              Restore from backup
            </Text>
          </View>
        </Pressable>
        {status && (
          <Text
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

      <Pressable onPress={resetAllData} style={[styles.button, { borderColor: theme.danger }]}>
        <Text style={{ color: theme.danger, fontWeight: '600' }}>Reset all data</Text>
      </Pressable>
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
    <Pressable onPress={onPress} accessibilityRole="link" style={styles.row}>
      <Text style={{ color: theme.text, fontSize: 15 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
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
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 8,
  },
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  faded: { opacity: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});
