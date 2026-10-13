import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useAiStatus } from '@/hooks/useAiStatus';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Router = ReturnType<typeof useRouter>;

/**
 * Home screen buttons. Add your own feature here: give it a label, an icon
 * and what happens on press (usually `router.push('/your-screen')`).
 * Buttons without `onPress` are empty placeholders for students to fill in.
 */
const ACTIONS: { label: string; icon: IconName; onPress?: (router: Router) => void }[] = [
  {
    label: 'AI Chat',
    icon: 'chatbubble-ellipses-outline',
    onPress: (router) => router.push('/chat' as Href),
  },
  { label: 'Your feature', icon: 'construct-outline' },
  { label: 'Your feature', icon: 'construct-outline' },
  { label: 'Your feature', icon: 'construct-outline' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const { problem, isOnline } = useAiStatus();

  const providerLabel =
    settings.provider === 'cloud' ? 'Cloud AI (Gemini)' : 'Local AI';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: theme.text }]}>
          Hi, {settings.nickname || 'there'}
        </Text>
        <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings' as Href)} />
      </View>
      <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
        What would you like to do today?
      </Text>

      <SmoothPressable
        onPress={() => router.push('/chat-settings' as Href)}
        style={[styles.status, { backgroundColor: theme.card, borderColor: theme.border }]}
      >
        <Ionicons
          name={problem ? 'alert-circle-outline' : 'checkmark-circle-outline'}
          size={24}
          color={problem ? theme.danger : theme.tint}
        />
        <View style={styles.flex}>
          <Text style={[styles.statusTitle, { color: theme.text }]}>{providerLabel}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
            {problem ?? 'Ready to chat'} - {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </SmoothPressable>

      <View style={styles.grid}>
        {ACTIONS.map((a, i) => (
          <SmoothPressable
            key={i}
            accessibilityRole="button"
            disabled={!a.onPress}
            onPress={() => a.onPress?.(router)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: a.onPress ? theme.buttonPrimary : theme.card,
                borderColor: a.onPress ? theme.buttonPrimary : theme.border,
                borderStyle: 'solid',
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <View style={styles.tileContent}>
              <Ionicons name={a.icon} size={32} color={a.onPress ? '#FFFFFF' : theme.textSecondary} />
              <Text style={[styles.tileLabel, { color: a.onPress ? '#FFFFFF' : theme.text }]}>{a.label}</Text>
            </View>
          </SmoothPressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 8 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  greeting: { flex: 1, fontSize: 28, fontWeight: '700' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginTop: 16,
  },
  statusTitle: { fontSize: 16, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  tile: {
    width: '47%',
    flexGrow: 1,
    aspectRatio: 1.3,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  tileContent: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 10 },
  tileLabel: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
