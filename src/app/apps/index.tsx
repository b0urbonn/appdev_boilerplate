import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { detectionStatsByApp, type AppDetectionStats } from '@/db/detections';
import { useAiStatus } from '@/hooks/useAiStatus';
import {
  appIconUri,
  launchApp,
  openAccessibilitySettings,
} from '@/monitor/native';
import { useMonitorService } from '@/monitor/useMonitorService';
import { useSettings } from '@/settings/SettingsContext';
import { relativeTime } from '@/utils/time';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type ProtectionState = 'protected' | 'paused' | 'setup';

/** Protection controls, protected-apps launcher, and per-app alert history. */
export default function ProtectedAppsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { problem } = useAiStatus();
  const [stats, setStats] = useState<Record<string, AppDetectionStats>>({});
  const { enabled: serviceOn, connected } = useMonitorService();
  const apps = settings.monitoredApps;
  const appCount = apps.length;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      detectionStatsByApp()
        .then((rows) => {
          if (active) setStats(Object.fromEntries(rows.map((r) => [r.packageName, r])));
        })
        .catch(() => {});
      return () => { active = false; };
    }, [])
  );

  const state: ProtectionState =
    !settings.monitoringEnabled ? 'paused'
    : serviceOn && connected && appCount > 0 && !problem ? 'protected'
    : 'setup';
  const providerLabel = settings.provider === 'cloud' ? 'Gemini' : 'Local AI';
  const statusLine =
    state === 'protected' ? `Watching ${appCount} app${appCount === 1 ? '' : 's'} · ${providerLabel}`
    : state === 'paused' ? 'Paused'
    : !serviceOn ? 'Accessibility permission is off'
    : !connected ? 'Accessibility is enabled, but Android has not connected the service. Turn Maalam off and on in Accessibility settings.'
    : appCount === 0 ? 'No apps selected'
    : (problem ?? 'Setup needed');
  const protectionColor =
    state === 'protected' ? '#178548'
    : state === 'paused' ? theme.textSecondary
    : settings.theme === 'dark' ? theme.warning : '#D97706';
  const protectionIcon: IconName =
    state === 'protected' ? 'shield-checkmark'
    : state === 'paused' ? 'shield-outline'
    : 'shield-half-outline';
  const protectionLabel = state === 'protected' ? 'Protected' : state === 'paused' ? 'Paused' : !serviceOn ? 'Enable accessibility' : !connected ? 'Reconnect service' : appCount === 0 ? 'Choose apps' : 'Set up AI';
  const action: { label: string; icon: IconName; primary: boolean; onPress: () => void } =
    !serviceOn
      ? { label: 'Turn on protection', icon: 'shield-checkmark-outline', primary: true, onPress: openAccessibilitySettings }
      : !connected
        ? { label: 'Reconnect in Accessibility settings', icon: 'refresh-outline', primary: true, onPress: openAccessibilitySettings }
      : appCount === 0
        ? { label: 'Choose apps', icon: 'apps-outline', primary: true, onPress: () => router.push('/protected-apps' as Href) }
        : problem
          ? { label: 'Set up AI', icon: 'sparkles-outline', primary: true, onPress: () => router.push('/chat-settings' as Href) }
          : state === 'paused'
            ? { label: 'Resume protection', icon: 'play-outline', primary: true, onPress: () => void update('monitoringEnabled', true) }
            : { label: 'Pause protection', icon: 'pause-outline', primary: false, onPress: () => void update('monitoringEnabled', false) };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
    >
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Open an app from here or as usual; Maalam watches it while it is open.
      </Text>

      <View style={[styles.protectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.protectionSummary}>
          <View style={[styles.protectionIcon, { backgroundColor: protectionColor }]}>
            <Ionicons name={protectionIcon} size={20} color="#FFFFFF" />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.protectionTitle, { color: theme.text }]}>{protectionLabel}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{statusLine}</Text>
          </View>
        </View>
        <Button
          label={action.label}
          icon={action.icon}
          variant={action.primary ? 'primary' : 'secondary'}
          onPress={action.onPress}
        />
      </View>

      {apps.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="apps-outline" size={48} color={theme.textSecondary} />
          <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
            No apps protected yet.
          </Text>
          <Button
            label="Choose apps"
            icon="apps-outline"
            onPress={() => router.push('/protected-apps' as Href)}
          />
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {apps.map((app) => {
              const stat = stats[app.packageName];
              return (
                <SmoothPressable
                  key={app.packageName}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${app.label}`}
                  onPress={() => void launchApp(app.packageName)}
                  style={styles.tile}
                >
                  <View>
                    <Image source={{ uri: appIconUri(app.packageName) }} style={styles.icon} />
                    {!!stat && stat.count > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {stat.count > 9 ? '9+' : stat.count}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                    {app.label}
                  </Text>
                </SmoothPressable>
              );
            })}
          </View>
          <Button
            label="Edit apps"
            icon="create-outline"
            onPress={() => router.push('/protected-apps' as Href)}
            style={{ marginTop: 8 }}
          />

          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Activity by app</Text>
          {apps.map((app) => {
            const stat = stats[app.packageName];
            return (
              <SmoothPressable
                key={app.packageName}
                accessibilityRole="button"
                accessibilityLabel={`${app.label} activity`}
                onPress={() => router.push(`/apps/${encodeURIComponent(app.packageName)}` as Href)}
                style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <Image source={{ uri: appIconUri(app.packageName) }} style={styles.rowIcon} />
                <View style={styles.flex}>
                  <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                    {app.label}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                    {stat && stat.count > 0
                      ? `${stat.count} alert${stat.count === 1 ? '' : 's'} · last ${relativeTime(stat.lastAt).toLowerCase()}`
                      : 'No alerts'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </SmoothPressable>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 8 },
  flex: { flex: 1 },
  subtitle: { fontSize: 15, marginBottom: 8 },
  protectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 8,
  },
  protectionSummary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  protectionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  protectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '25%', alignItems: 'center', gap: 6, paddingBottom: 16 },
  icon: { width: 56, height: 56, borderRadius: 14 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  label: { fontSize: 12, textAlign: 'center' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 10 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 14, paddingVertical: 48 },
});
