import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AVATAR_OPTIONS, ProfileAvatar } from '@/components/ProfileAvatar';
import { Section } from '@/components/Section';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme, type Theme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function formatJoinDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Dedicated profile page: identity plus the user's protection summary. */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState(settings.nickname);
  const [editingNickname, setEditingNickname] = useState(false);

  const saveNickname = () => {
    const name = draft.trim();
    setDraft(name);
    if (name !== settings.nickname) void update('nickname', name);
    setEditingNickname(false);
  };

  const editNickname = () => {
    setDraft(settings.nickname);
    setEditingNickname(true);
  };

  const shuffleAvatar = () => {
    const choices = AVATAR_OPTIONS.filter((avatar) => avatar.id !== settings.profileAvatar);
    const next = choices[Math.floor(Math.random() * choices.length)];
    if (next) void update('profileAvatar', next.id);
  };
  const appCount = settings.monitoredApps.length;
  const protection = !settings.monitoringEnabled
    ? 'Paused'
    : appCount === 0
      ? 'Not set up'
      : 'On';
  const memberDays = settings.joinedAt
    ? Math.max(1, Math.floor((new Date().getTime() - settings.joinedAt) / 86_400_000) + 1)
    : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.identity, { backgroundColor: theme.card }]}>
        <View style={styles.avatarWrap}>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Profile avatar"
            accessibilityHint="Tap to shuffle to a new avatar"
            onPress={shuffleAvatar}
            style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1 }]}
          >
            <ProfileAvatar avatarId={settings.profileAvatar} size={84} />
          </SmoothPressable>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Shuffle profile character"
            onPress={shuffleAvatar}
            style={({ pressed }) => [
              styles.shuffleButton,
              { backgroundColor: theme.buttonPrimary, borderColor: theme.card, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Ionicons name="shuffle" size={16} color="#FFFFFF" />
          </SmoothPressable>
        </View>

        <View style={styles.nicknameRow}>
          {editingNickname ? (
            <View
              style={[
                styles.nameBox,
                { backgroundColor: theme.inputBackground, borderColor: theme.border },
              ]}
            >
              <TextInput
                accessibilityLabel="Nickname"
                autoFocus
                value={draft}
                onChangeText={setDraft}
                onBlur={saveNickname}
                onSubmitEditing={saveNickname}
                maxLength={30}
                returnKeyType="done"
                placeholder="Your nickname"
                placeholderTextColor={theme.textSecondary}
                style={[styles.nameInput, { color: theme.text }]}
              />
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel="Save nickname"
                onPress={saveNickname}
                style={({ pressed }) => [
                  styles.nameBoxAction,
                  { backgroundColor: theme.buttonSecondary, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Ionicons name="checkmark" size={15} color={theme.tint} />
              </SmoothPressable>
            </View>
          ) : (
            <>
              <Text
                style={[styles.nickname, { color: settings.nickname ? theme.text : theme.textSecondary }]}
                numberOfLines={1}
              >
                {settings.nickname || 'Your nickname'}
              </Text>
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel="Edit nickname"
                onPress={editNickname}
                style={({ pressed }) => [
                  styles.nicknameAction,
                  { backgroundColor: theme.buttonSecondary, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Ionicons name="pencil" size={13} color={theme.tint} />
              </SmoothPressable>
            </>
          )}
        </View>
        <Text style={[styles.joined, { color: theme.textSecondary }]}>
          Joined {formatJoinDate(settings.joinedAt)}
          {memberDays > 0 ? ` · ${memberDays} day${memberDays === 1 ? '' : 's'} with Maalam` : ''}
        </Text>
      </View>

      <Section title="Protection" theme={theme}>
        <Row label="Status" value={protection} theme={theme} />
        <LinkRow
          icon="apps-outline"
          label="Protected apps"
          value={`${appCount}`}
          onPress={() => router.push('/protected-apps' as Href)}
          theme={theme}
        />
        <LinkRow
          icon="sparkles-outline"
          label="AI engine"
          value={settings.provider === 'local' ? 'On-device' : 'Cloud'}
          onPress={() => router.push('/chat-settings' as Href)}
          theme={theme}
        />
      </Section>
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

function LinkRow({
  icon,
  label,
  value,
  onPress,
  theme,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <SmoothPressable
      accessibilityRole="link"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={[styles.row, styles.linkRow, { backgroundColor: theme.background }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme.buttonSecondary }]}>
        <Ionicons name={icon} size={16} color={theme.tint} />
      </View>
      <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>{label}</Text>
      {value ? <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  identity: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    marginBottom: 16,
  },
  avatarWrap: { width: 84, height: 84, position: 'relative' },
  shuffleButton: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  nicknameRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nickname: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 6,
  },
  nameBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 40,
    paddingRight: 4,
    gap: 6,
  },
  nameInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  nameBoxAction: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nicknameAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joined: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  linkRow: {
    minHeight: 48,
    marginTop: 5,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
