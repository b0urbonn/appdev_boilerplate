import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ActivityChart } from '@/components/ActivityChart';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { IconButton } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { countDetectionsSince } from '@/db/detections';
import { useWeeklyActivity } from '@/hooks/useWeeklyActivity';
import { LESSONS } from '@/learn/lessons';
import { openUsageAccessSettings } from '@/monitor/native';
import { enter, exitFade, fadeIn, pop } from '@/motion';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const [unread, setUnread] = useState(0);
  const alertsSeenRef = useRef(0);
  useEffect(() => { alertsSeenRef.current = settings.alertsSeenAt; });

  const appCount = settings.monitoredApps.length;
  const packages = useMemo(
    () => settings.monitoredApps.map((a) => a.packageName),
    [settings.monitoredApps]
  );
  const activity = useWeeklyActivity(packages);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      countDetectionsSince(alertsSeenRef.current)
        .then((n) => { if (active) setUnread(n); })
        .catch(() => {});
      return () => { active = false; };
    }, [])
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = settings.nickname.trim();

  const featuredLesson = LESSONS.find((lesson) => lesson.id === 'verify-sharing') ?? LESSONS[0];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
    >
      <Animated.View entering={fadeIn()} style={styles.headerIcons}>
        <View>
          <IconButton
            icon="notifications-outline"
            label={unread > 0 ? `Alerts, ${unread} new` : 'Alerts'}
            onPress={() => router.push('/alerts' as Href)}
          />
          {unread > 0 && (
            <Animated.View entering={pop(300)} exiting={exitFade} style={styles.badge} pointerEvents="none">
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </Animated.View>
          )}
        </View>
        <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings' as Href)} />
      </Animated.View>
      <Animated.Text entering={enter(0)} style={[styles.greeting, { color: theme.text }]}>
        {greeting}{name ? `, ${name}` : ''}
      </Animated.Text>
      <Animated.Text entering={enter(1)} style={[styles.subtitle, { color: theme.textSecondary }]}>
        Manage app protection, check suspicious content, and build safer habits.
      </Animated.Text>

      <Animated.View entering={enter(2)}>
        <ActivityChart
          days={activity.days}
          usageAccess={activity.usageAccess}
          hasApps={appCount > 0}
          onAllowUsage={() => {
            const opened = openUsageAccessSettings();
            if (Platform.OS === 'web') {
              // The web stub grants access synchronously; Android re-checks on resume.
              activity.reload().catch(() => {});
            } else if (!opened) {
              Alert.alert(
                'Could not open Settings',
                'Open Android Settings > Apps > Special app access > Usage access, then allow Maalam.'
              );
            }
          }}
          onChooseApps={() => router.push('/protected-apps' as Href)}
        />
      </Animated.View>

      <Animated.View entering={enter(3)} style={styles.contentSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Your coverage</Text>
        <View style={styles.statsRow}>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel={`${appCount} monitored apps. Manage protected apps`}
            onPress={() => router.push('/protected-apps' as Href)}
            style={({ pressed }) => [
              styles.statCard,
              { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.statIcon, { backgroundColor: theme.buttonSecondary }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.tint} />
            </View>
            <AnimatedNumber value={appCount} style={[styles.statValue, { color: theme.text }]} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>monitored apps</Text>
          </SmoothPressable>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel={`${unread} new alerts. View alerts`}
            onPress={() => router.push('/alerts' as Href)}
            style={({ pressed }) => [
              styles.statCard,
              { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.statIcon, { backgroundColor: theme.buttonSecondary }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.tint} />
            </View>
            <AnimatedNumber value={unread} style={[styles.statValue, { color: theme.text }]} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>new alerts</Text>
          </SmoothPressable>
        </View>
      </Animated.View>

      <Animated.View entering={enter(4)} style={styles.contentSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick actions</Text>
        <View style={styles.actionsRow}>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Scan a photo, video, audio clip, or message"
            onPress={() => router.push('/(tabs)/scan' as Href)}
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.buttonSecondary }]}>
              <Ionicons name="scan-outline" size={22} color={theme.tint} />
            </View>
            <Text style={[styles.actionTitle, { color: theme.text }]}>Check content</Text>
            <Text style={[styles.actionHint, { color: theme.textSecondary }]}>Scan a photo or message</Text>
          </SmoothPressable>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Ask Maalam a question"
            onPress={() => router.push('/(tabs)/chat' as Href)}
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.buttonSecondary }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.tint} />
            </View>
            <Text style={[styles.actionTitle, { color: theme.text }]}>Ask Maalam</Text>
            <Text style={[styles.actionHint, { color: theme.textSecondary }]}>Get help with a concern</Text>
          </SmoothPressable>
        </View>
      </Animated.View>

      <Animated.View entering={enter(5)} style={styles.contentSection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>A quick safety tip</Text>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel={`${featuredLesson.title}. ${featuredLesson.readMinutes} minute read`}
          onPress={() => router.push(`/learn/${featuredLesson.id}` as Href)}
          style={({ pressed }) => [
            styles.tipCard,
            { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={[styles.tipIcon, { backgroundColor: theme.buttonSecondary }]}>
            <Ionicons name={featuredLesson.icon} size={22} color={theme.tint} />
          </View>
          <View style={styles.tipCopy}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>{featuredLesson.title}</Text>
            <Text style={[styles.actionHint, { color: theme.textSecondary }]} numberOfLines={2}>
              {featuredLesson.summary}
            </Text>
            <Text style={[styles.tipLink, { color: theme.tint }]}>{featuredLesson.readMinutes} min read · Read tip</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </SmoothPressable>
      </Animated.View>

      {Platform.OS === 'web' && (
        <SmoothPressable
          accessibilityRole="link"
          accessibilityLabel="Preview monitor overlay"
          onPress={() => router.push('/monitor-preview' as Href)}
          style={styles.previewLink}
        >
          <Text style={{ color: theme.tint, fontSize: 14, fontWeight: '600' }}>
            Preview monitor overlay
          </Text>
        </SmoothPressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 24, gap: 12 },
  greeting: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: -6 },
  contentSection: { gap: 10, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    minHeight: 124,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    gap: 3,
  },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 24, lineHeight: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 13, fontWeight: '500' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionCard: {
    flex: 1,
    minHeight: 132,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 13,
    gap: 5,
  },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  actionTitle: { fontSize: 14, fontWeight: '700' },
  actionHint: { fontSize: 12, lineHeight: 17 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  tipIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tipCopy: { flex: 1, gap: 3 },
  tipLink: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  previewLink: { alignSelf: 'center', paddingVertical: 12 },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
