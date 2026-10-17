import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { getInstalledApps, type InstalledApp } from '@/monitor/native';
import { useTheme } from '@/theme';
import { typography } from '@/typography';

export interface SelectedLiveTarget {
  packageName: string;
  label: string;
  iconUri?: string;
}

interface LiveScanPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectApp: (app: SelectedLiveTarget) => void;
  onSelectScreen: () => void;
}

export function LiveScanPickerModal({
  visible,
  onClose,
  onSelectApp,
  onSelectScreen,
}: LiveScanPickerModalProps) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [installedApps, setInstalledApps] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    getInstalledApps()
      .then((list) => {
        if (active) setInstalledApps(list);
      })
      .catch(() => {
        if (active) setInstalledApps([]);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const filteredApps = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!installedApps) return [];
    if (!value) return installedApps;
    return installedApps.filter(
      (app) => app.label.toLowerCase().includes(value) || app.packageName.toLowerCase().includes(value)
    );
  }, [installedApps, query]);

  const showScreenChoice = !query.trim();

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={styles.scrim}>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel="Close source picker"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.dragHandleRow}>
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: theme.text }]}>Choose a source</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Choose an app to monitor, or share a screen for this session.</Text>
            </View>
            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.buttonSecondary }]}
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </SmoothPressable>
          </View>

          <View style={[styles.searchBar, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              accessibilityLabel="Search installed apps"
              value={query}
              onChangeText={setQuery}
              placeholder="Search apps"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {!!query && Platform.OS !== 'ios' && (
              <SmoothPressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </SmoothPressable>
            )}
          </View>

          <FlatList
            data={filteredApps}
            keyExtractor={(item) => item.packageName}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View>
                {showScreenChoice && (
                  <>
                    <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>SHARE FROM ANDROID</Text>
                    <SmoothPressable
                      accessibilityRole="button"
                      accessibilityLabel="Choose an app window or display to share for live scan"
                      onPress={onSelectScreen}
                      style={({ pressed }) => [
                        styles.screenRow,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.border,
                          opacity: pressed ? 0.82 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.screenIcon, { backgroundColor: theme.buttonSecondary }]}>
                        <Ionicons name="phone-portrait-outline" size={21} color={theme.tint} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={[styles.appName, { color: theme.text }]}>App window or display</Text>
                        <Text style={[styles.appHint, { color: theme.textSecondary }]}>Android will let you choose what to share</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </SmoothPressable>
                    <Text style={[styles.sectionHeading, styles.appsHeading, { color: theme.textSecondary }]}>
                      MONITOR AN APP{installedApps ? ` · ${installedApps.length}` : ''}
                    </Text>
                  </>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.label} for live scan`}
                onPress={() => onSelectApp({ packageName: item.packageName, label: item.label, iconUri: item.iconUri })}
                style={({ pressed }) => [styles.appRow, { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
              >
                {item.iconUri ? (
                  <Image source={{ uri: item.iconUri }} style={styles.appIcon} />
                ) : (
                  <View style={[styles.appIcon, styles.appFallbackIcon, { backgroundColor: theme.buttonSecondary }]}>
                    <Ionicons name="apps-outline" size={19} color={theme.textSecondary} />
                  </View>
                )}
                <Text style={[styles.appName, styles.flex, { color: theme.text }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
              </SmoothPressable>
            )}
            ListEmptyComponent={
              installedApps === null ? (
                <ActivityIndicator color={theme.tint} style={styles.loading} />
              ) : (
                <View style={styles.emptyWrap}>
                  <Ionicons name="search-outline" size={28} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    {query.trim() ? 'No matching apps found.' : 'No installed apps found.'}
                  </Text>
                </View>
              )
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingBottom: 24,
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  flex: { flex: 1 },
  title: {
    ...typography.sectionTitle,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 13,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  sectionHeading: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginHorizontal: 3,
    marginBottom: 8,
  },
  appsHeading: {
    marginTop: 20,
  },
  screenRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  screenIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  appFallbackIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    ...typography.label,
  },
  appHint: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 1,
  },
  loading: {
    marginTop: 28,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 34,
    gap: 8,
  },
  emptyText: {
    ...typography.caption,
  },
});
