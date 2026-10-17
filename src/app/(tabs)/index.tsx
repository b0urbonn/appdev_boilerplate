import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ActivityChart } from '@/components/ActivityChart';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { IconButton } from '@/components/Button';
import { MascotImage } from '@/components/MascotImage';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { SmoothPressable } from '@/components/SmoothPressable';
import { StreakDetailsModal } from '@/components/StreakDetailsModal';
import { countDetectionsSince } from '@/db/detections';
import { useHistoryStreak } from '@/hooks/useHistoryStreak';
import { useWeeklyActivity } from '@/hooks/useWeeklyActivity';
import { LESSONS } from '@/learn/lessons';
import { openUsageAccessSettings } from '@/monitor/native';
import { enter, exitFade, fadeIn, pop, SPRING_BOUNCY } from '@/motion';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';
import { typography } from '@/typography';

const MASCOT_LINES = [
  'Stay sharp — the internet is full of traps!',
  'I smell something phishy… want me to check it?',
  'A clever fox always verifies before sharing.',
  'Tails up! Nothing gets past us today.',
  'Psst — scanned anything suspicious lately?',
  'Trust your snout. If it feels off, check it.',
  'Even foxes look twice before they leap.',
  "I've got your back. Go ahead, browse boldly.",
];

const GRASS_TUFTS = [
  { left: '24%', bottom: 26 },
  { left: '40%', bottom: 46 },
  { left: '56%', bottom: 14 },
  { left: '71%', bottom: 38 },
  { left: '87%', bottom: 22 },
] as const;

const FLOWERS = [
  { left: '31%', bottom: 16, backgroundColor: '#FFD166' },
  { left: '63%', bottom: 32, backgroundColor: '#FF8FA3' },
  { left: '80%', bottom: 48, backgroundColor: '#FFFFFF' },
] as const;

const STARS = [
  { left: '8%', top: 14 },
  { left: '18%', top: 44 },
  { left: '32%', top: 20 },
  { left: '47%', top: 10 },
  { left: '57%', top: 38 },
  { left: '70%', top: 14 },
  { left: '82%', top: 48 },
  { left: '91%', top: 30 },
  { left: '64%', top: 56 },
] as const;

type ScenePhase = 'dawn' | 'day' | 'dusk' | 'night';

const SCENE_PALETTE: Record<
  ScenePhase,
  {
    sky: string;
    horizon: string;
    grass: string;
    grassEdge: string;
    platform: string;
    tuft: string;
    treeTop: string;
    treeLeaf: string;
    trunk: string;
    cloud: string;
    celestial: string;
    celestialGlow: string;
    celestialBottom: `${number}%`;
    stars: boolean;
  }
> = {
  dawn: {
    sky: '#F2A65E',
    horizon: '#FBD9A5',
    grass: '#54AE5F',
    grassEdge: '#43954E',
    platform: '#84CF84',
    tuft: '#357F42',
    treeTop: '#4FB366',
    treeLeaf: '#3C9450',
    trunk: '#8B5A3C',
    cloud: '#FFDFC0',
    celestial: '#FF9440',
    celestialGlow: '#FFC48A',
    celestialBottom: '36%',
    stars: false,
  },
  day: {
    sky: '#8FD3F4',
    horizon: '#BEE9FA',
    grass: '#5DBB63',
    grassEdge: '#49A452',
    platform: '#8BD487',
    tuft: '#3E9B4F',
    treeTop: '#57C46B',
    treeLeaf: '#3E9B4F',
    trunk: '#8B5A3C',
    cloud: '#FFFFFF',
    celestial: '#FFD93D',
    celestialGlow: '#FFEF9E',
    celestialBottom: '70%',
    stars: false,
  },
  dusk: {
    sky: '#7C5296',
    horizon: '#FF9E6B',
    grass: '#41904F',
    grassEdge: '#347C41',
    platform: '#6FBB78',
    tuft: '#2E7340',
    treeTop: '#3F9C55',
    treeLeaf: '#2F7D45',
    trunk: '#6E4630',
    cloud: '#D8B3E0',
    celestial: '#FF7043',
    celestialGlow: '#FFB08A',
    celestialBottom: '38%',
    stars: false,
  },
  night: {
    sky: '#16234A',
    horizon: '#2C3E70',
    grass: '#1F5C3A',
    grassEdge: '#1A4C30',
    platform: '#35704B',
    tuft: '#16402A',
    treeTop: '#2A5C40',
    treeLeaf: '#1E4A32',
    trunk: '#4E3524',
    cloud: '#33457A',
    celestial: '#E8EAF6',
    celestialGlow: '#C6CBE8',
    celestialBottom: '68%',
    stars: true,
  },
};

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const [unread, setUnread] = useState(0);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [lineIndex, setLineIndex] = useState(() =>
    Math.floor(Math.random() * MASCOT_LINES.length)
  );
  const [typed, setTyped] = useState(0);
  const streakInfo = useHistoryStreak();
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
      setLineIndex(
        (i) => (i + 1 + Math.floor(Math.random() * (MASCOT_LINES.length - 1))) % MASCOT_LINES.length
      );
      setTyped(0);
      return () => { active = false; };
    }, [])
  );

  const mascotMsg = MASCOT_LINES[lineIndex];
  useEffect(() => {
    if (typed < mascotMsg.length) {
      const t = setTimeout(() => setTyped((v) => v + 1), 34);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLineIndex(
        (i) => (i + 1 + Math.floor(Math.random() * (MASCOT_LINES.length - 1))) % MASCOT_LINES.length
      );
      setTyped(0);
    }, 4500);
    return () => clearTimeout(t);
  }, [typed, mascotMsg]);

  // The mascot squashes top-to-bottom each time it says a new line.
  const squash = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) return;
    squash.value = withSequence(
      withTiming(0.84, { duration: 150, easing: Easing.in(Easing.quad) }),
      withSpring(1, SPRING_BOUNCY)
    );
  }, [lineIndex, reducedMotion, squash]);
  const mascotSquash = useAnimatedStyle(() => ({
    // scaleY squeezes about the center, so push down by half the lost height
    // to keep the feet planted — same as transformOrigin: 'bottom' but works
    // everywhere Reanimated styles do.
    transform: [
      { translateY: (1 - squash.value) * 75 },
      { scaleY: squash.value },
    ],
  }));

  // Pixel clouds drift across the scene like a Game Boy overworld backdrop.
  const cloudX1 = useSharedValue(120);
  const cloudX2 = useSharedValue(420);
  useEffect(() => {
    if (reducedMotion) return;
    // Finish the on-screen pass first, then wrap off-screen for a seamless loop.
    cloudX1.value = withSequence(
      withTiming(720, { duration: 29000, easing: Easing.linear }),
      withTiming(-70, { duration: 0 }),
      withRepeat(withTiming(720, { duration: 38000, easing: Easing.linear }), -1, false)
    );
    cloudX2.value = withSequence(
      withTiming(720, { duration: 21000, easing: Easing.linear }),
      withTiming(-70, { duration: 0 }),
      withRepeat(withTiming(720, { duration: 55000, easing: Easing.linear }), -1, false)
    );
  }, [cloudX1, cloudX2, reducedMotion]);
  const cloudStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateX: cloudX1.value }],
  }));
  const cloudStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateX: cloudX2.value }],
  }));

  // Re-render once a minute so the scene sky follows the clock live.
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMinuteTick((v) => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = settings.nickname.trim();
  const phase: ScenePhase = hour < 5 ? 'night' : hour < 8 ? 'dawn' : hour < 17 ? 'day' : hour < 20 ? 'dusk' : 'night';
  const pal = SCENE_PALETTE[phase];
  const dateLine = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const featuredLesson = LESSONS.find((lesson) => lesson.id === 'verify-sharing') ?? LESSONS[0];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={Platform.OS !== 'web'}
    >
      <View style={styles.contentWrap}>
        <Animated.View entering={fadeIn()} style={styles.topHeaderRow}>
          {/* Upper Left: Safety Streak Icon */}
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel={`Safety streak: ${streakInfo.streak} day${streakInfo.streak === 1 ? '' : 's'}. Based on daily alerts and scans in history. Tap to view details.`}
            accessibilityHint="Opens streak details breakdown"
            onPress={() => setStreakModalOpen(true)}
            style={({ pressed }) => [
              styles.streakPill,
              { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons
              name={streakInfo.streak > 0 ? 'flame' : 'flame-outline'}
              size={15}
              color={streakInfo.streak > 0 ? '#FF6B00' : theme.textSecondary}
            />
            <Text
              style={[
                styles.streakNumber,
                { color: streakInfo.streak > 0 ? theme.text : theme.textSecondary },
              ]}
            >
              {streakInfo.streak}
            </Text>
          </SmoothPressable>

          {/* Upper Right: Actions */}
          <View style={styles.headerRightActions}>
            <View>
              <IconButton
                icon="notifications-outline"
                label={unread > 0 ? `Alerts, ${unread} new` : 'Alerts'}
                variant="ghost"
                onPress={() => router.push('/alerts' as Href)}
              />
              {unread > 0 && (
                <Animated.View entering={pop(300)} exiting={exitFade} style={styles.badge} pointerEvents="none">
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </Animated.View>
              )}
            </View>
            <IconButton icon="settings-outline" label="Settings" variant="ghost" onPress={() => router.push('/settings' as Href)} />
            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel={name ? `Profile, ${name}` : 'Profile'}
              accessibilityHint="Opens your profile page"
              onPress={() => router.push('/profile' as Href)}
              style={({ pressed }) => [
                styles.avatar,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ProfileAvatar avatarId={settings.profileAvatar} size={38} />
            </SmoothPressable>
          </View>
        </Animated.View>
        <Animated.Text entering={enter(0)} style={[styles.dateLine, { color: theme.textSecondary }]}>
          {dateLine}
        </Animated.Text>
        <Animated.Text entering={enter(1)} style={[styles.greeting, { color: theme.text }]}>
          {greeting}{name ? `, ${name}` : ''}.
        </Animated.Text>

        <Animated.View entering={enter(2)} style={styles.scene}>
          {/* Game world backdrop */}
          <View style={[styles.sky, { backgroundColor: pal.sky }]} />
          <View style={[styles.horizon, { backgroundColor: pal.horizon }]} />
          {pal.stars &&
            STARS.map((s, i) => <View key={i} style={[styles.star, s]} pointerEvents="none" />)}
          <View
            style={[styles.celestial, { bottom: pal.celestialBottom }]}
            pointerEvents="none"
          >
            <View style={[styles.celestialGlow, { backgroundColor: pal.celestialGlow }]} />
            <View style={[styles.celestialBody, { backgroundColor: pal.celestial }]}>
              {phase === 'night' && (
                <View style={[styles.moonCrater, { backgroundColor: pal.sky }]} />
              )}
            </View>
          </View>
          <Animated.View style={[styles.cloud, styles.cloudSmall, cloudStyle2]} pointerEvents="none">
            <View style={[styles.cloudTop, { backgroundColor: pal.cloud }]} />
            <View style={[styles.cloudBase, { backgroundColor: pal.cloud }]} />
          </Animated.View>
          <Animated.View style={[styles.cloud, cloudStyle1]} pointerEvents="none">
            <View style={[styles.cloudTop, { backgroundColor: pal.cloud }]} />
            <View style={[styles.cloudBase, { backgroundColor: pal.cloud }]} />
          </Animated.View>
          <View style={[styles.grass, { backgroundColor: pal.grass }]} />
          <View style={[styles.grassEdge, { backgroundColor: pal.grassEdge }]} />
          {GRASS_TUFTS.map((t, i) => (
            <View key={i} style={[styles.tuft, t, { backgroundColor: pal.tuft }]} />
          ))}
          {FLOWERS.map((f, i) => (
            <View key={i} style={[styles.flower, f]} />
          ))}
          <View style={styles.tree} pointerEvents="none">
            <View style={[styles.treeCanopyTop, { backgroundColor: pal.treeTop }]} />
            <View style={[styles.treeCanopy, { backgroundColor: pal.treeLeaf }]} />
            <View style={[styles.treeTrunk, { backgroundColor: pal.trunk }]} />
          </View>
          <View style={[styles.platform, { backgroundColor: pal.platform }]} />
          <View style={styles.mascotRow}>
            <Animated.View style={mascotSquash}>
              <MascotImage
                style={styles.mascot}
                accessibilityLabel="Maalam the fox mascot"
              />
            </Animated.View>
            <View style={[styles.bubble, { backgroundColor: theme.card }]}>
              <View style={[styles.bubbleTailStepLarge, { backgroundColor: theme.card }]} />
              <View style={[styles.bubbleTailStepSmall, { backgroundColor: theme.card }]} />
              <Text style={[styles.bubbleText, { color: theme.text }]}>
                {mascotMsg.slice(0, typed)}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={enter(3)} style={styles.contentSection}>
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

        <Animated.View entering={enter(4)} style={styles.contentSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your coverage</Text>
          <View style={styles.statsRow}>
            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel={`${appCount} monitored apps. Manage protected apps`}
              onPress={() => router.push('/protected-apps' as Href)}
              style={({ pressed }) => [
                styles.statCard,
                { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.statIcon, { backgroundColor: theme.buttonSecondary }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color={theme.tint} />
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
                { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
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

        <Animated.View entering={enter(5)} style={styles.contentSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick actions</Text>
          <View style={styles.actionsRow}>
            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel="Scan a photo, video, audio clip, or message"
              onPress={() => router.push('/(tabs)/scan' as Href)}
              style={({ pressed }) => [
                styles.actionCard,
                { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
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
                { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
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

        <Animated.View entering={enter(6)} style={styles.contentSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Safety tip</Text>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel={`${featuredLesson.title}. ${featuredLesson.readMinutes} minute read`}
            onPress={() => router.push(`/learn/${featuredLesson.id}` as Href)}
            style={({ pressed }) => [
              styles.tipCard,
              { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
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
      </View>
      <StreakDetailsModal
        visible={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
        streak={streakInfo.streak}
        todayAlerts={streakInfo.todayAlerts}
        todayScans={streakInfo.todayScans}
        activeToday={streakInfo.activeToday}
        historyDays={streakInfo.historyDays}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 120 : 36,
    alignItems: 'center',
  },
  contentWrap: {
    width: '100%',
    maxWidth: 640,
    gap: 16,
  },
  greeting: { ...typography.screenTitle, marginTop: -10 },
  dateLine: typography.body,
  scene: {
    height: 190,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '62%',
    backgroundColor: '#8FD3F4',
  },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '54%',
    height: 14,
    backgroundColor: '#BEE9FA',
  },
  grass: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    backgroundColor: '#5DBB63',
  },
  grassEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '39%',
    height: 8,
    backgroundColor: '#49A452',
  },
  platform: {
    position: 'absolute',
    left: 4,
    bottom: -6,
    width: 148,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#8BD487',
  },
  tuft: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#3E9B4F',
  },
  flower: {
    position: 'absolute',
    width: 5,
    height: 5,
  },
  tree: {
    position: 'absolute',
    right: 16,
    bottom: '39%',
    alignItems: 'center',
  },
  treeCanopyTop: {
    width: 22,
    height: 10,
    backgroundColor: '#57C46B',
  },
  treeCanopy: {
    width: 34,
    height: 22,
    backgroundColor: '#3E9B4F',
  },
  treeTrunk: {
    width: 8,
    height: 12,
    backgroundColor: '#8B5A3C',
  },
  cloud: {
    position: 'absolute',
    top: 16,
    left: 0,
    width: 56,
    height: 18,
  },
  cloudSmall: {
    top: 40,
    width: 38,
    height: 13,
    opacity: 0.85,
  },
  cloudTop: {
    position: 'absolute',
    left: '22%',
    top: 0,
    width: '56%',
    height: '45%',
  },
  cloudBase: {
    position: 'absolute',
    left: 0,
    top: '45%',
    width: '100%',
    height: '55%',
  },
  star: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#E8EAF6',
  },
  celestial: {
    position: 'absolute',
    right: '22%',
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celestialGlow: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 5,
    opacity: 0.4,
  },
  celestialBody: {
    width: 18,
    height: 18,
    borderRadius: 3,
    overflow: 'hidden',
  },
  moonCrater: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: 7,
    height: 7,
  },
  mascotRow: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mascot: {
    width: 118,
    height: 150,
  },
  bubble: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  // Stepped square tail points down-left toward the mascot's mouth —
  // keeps the speech bubble on-theme with the pixel-art scene instead of
  // rendering as a floating rotated diamond.
  bubbleTailStepLarge: {
    position: 'absolute',
    left: -7,
    top: 22,
    width: 10,
    height: 10,
  },
  bubbleTailStepSmall: {
    position: 'absolute',
    left: -13,
    top: 30,
    width: 6,
    height: 6,
  },
  bubbleText: { fontSize: 14, lineHeight: 20, fontWeight: '600', minHeight: 40 },
  contentSection: { gap: 10 },
  sectionTitle: typography.sectionTitle,
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    minHeight: 124,
    borderRadius: 16,
    padding: 14,
    gap: 3,
  },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: typography.statistic,
  statLabel: { fontSize: 13, fontWeight: '500' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionCard: {
    flex: 1,
    minHeight: 124,
    borderRadius: 16,
    padding: 14,
    gap: 5,
  },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  actionTitle: { fontSize: 14, fontWeight: '700' },
  actionHint: { fontSize: 12, lineHeight: 17 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
  },
  tipIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipCopy: { flex: 1, gap: 3 },
  tipLink: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  previewLink: { alignSelf: 'center', paddingVertical: 12 },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  streakNumber: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
