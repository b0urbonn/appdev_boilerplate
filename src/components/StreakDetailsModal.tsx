import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useTheme } from '@/theme';

interface StreakDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  streak: number;
  todayAlerts: number;
  todayScans: number;
  activeToday: boolean;
  historyDays: { start: number; active: boolean; alerts: number; scans: number }[];
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StreakDetailsModal({
  visible,
  onClose,
  streak,
  todayAlerts,
  todayScans,
  activeToday,
  historyDays,
}: StreakDetailsModalProps) {
  const theme = useTheme();
  const router = useRouter();

  const isDark = theme.text !== '#111111';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss streak details"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleRow}>
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
          </View>

          {/* Header Close */}
          <View style={styles.topBar}>
            <View style={styles.flex} />
            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.buttonSecondary }]}
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </SmoothPressable>
          </View>

          {/* Hero Flame Arena */}
          <View style={styles.heroSection}>
            <View
              style={[
                styles.flameCircle,
                {
                  backgroundColor: streak > 0 ? 'rgba(255, 107, 0, 0.14)' : theme.buttonSecondary,
                  borderColor: streak > 0 ? 'rgba(255, 107, 0, 0.35)' : theme.border,
                },
              ]}
            >
              <Ionicons
                name={streak > 0 ? 'flame' : 'flame-outline'}
                size={44}
                color={streak > 0 ? '#FF6B00' : theme.textSecondary}
              />
            </View>

            <Text style={[styles.streakTitle, { color: theme.text }]}>
              {streak > 0 ? `${streak} Day Safety Streak` : 'Start Your Streak'}
            </Text>
            <Text style={[styles.streakSubtitle, { color: theme.textSecondary }]}>
              {streak > 7
                ? `Outstanding! You have maintained an unbroken safety streak for ${streak} consecutive days.`
                : 'Based strictly on your daily alerts flagged and detected scans in History.'}
            </Text>
          </View>

          {/* Today's Activity Card */}
          <View
            style={[
              styles.todayCard,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.todayCardHeader}>
              <Text style={[styles.cardHeaderLabel, { color: theme.textSecondary }]}>
                {`TODAY'S ACTIVITY`}
              </Text>
              <View
                style={[
                  styles.statusTag,
                  {
                    backgroundColor: activeToday
                      ? isDark
                        ? 'rgba(46, 125, 50, 0.25)'
                        : 'rgba(46, 125, 50, 0.12)'
                      : isDark
                      ? 'rgba(154, 154, 163, 0.2)'
                      : 'rgba(0, 0, 0, 0.05)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: activeToday ? theme.success : theme.textSecondary },
                  ]}
                />
                <Text
                  style={[
                    styles.statusTagText,
                    { color: activeToday ? theme.success : theme.textSecondary },
                  ]}
                >
                  {activeToday ? 'Streak Extended' : 'Awaiting Activity'}
                </Text>
              </View>
            </View>

            <View style={styles.countsRow}>
              <View style={styles.countItem}>
                <Text style={[styles.countValue, { color: theme.text }]}>{todayAlerts}</Text>
                <Text style={[styles.countLabel, { color: theme.textSecondary }]}>
                  Alerts Flagged
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.countItem}>
                <Text style={[styles.countValue, { color: theme.text }]}>{todayScans}</Text>
                <Text style={[styles.countLabel, { color: theme.textSecondary }]}>
                  Scans Run
                </Text>
              </View>
            </View>
          </View>

          {/* 7-Day History Track */}
          <View style={styles.weekTrackSection}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {streak > 7
                ? `RECENT 7 DAYS · ${streak} DAYS TOTAL`
                : 'LAST 7 DAYS ACTIVITY'}
            </Text>
            <View style={styles.weekBubblesRow}>
              {historyDays.map((d, i) => {
                const date = new Date(d.start);
                const dayName = WEEKDAY_NAMES[date.getDay()];
                const isToday = i === historyDays.length - 1;

                return (
                  <View key={d.start} style={styles.dayCol}>
                    <View
                      style={[
                        styles.dayBubble,
                        {
                          backgroundColor: d.active
                            ? '#FF6B00'
                            : theme.inputBackground,
                          borderColor: isToday
                            ? theme.tint
                            : theme.border,
                          borderWidth: isToday ? 2 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <Ionicons
                        name={d.active ? 'flame' : 'remove'}
                        size={16}
                        color={d.active ? '#FFFFFF' : theme.textSecondary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.dayLetter,
                        {
                          color: isToday ? theme.tint : theme.textSecondary,
                          fontWeight: isToday ? '700' : '500',
                        },
                      ]}
                    >
                      {dayName}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Bottom Actions */}
          <View style={styles.buttonGroup}>
            <Button
              label="View Full History"
              icon="time-outline"
              onPress={() => {
                onClose();
                router.push('/(tabs)/history' as Href);
              }}
              style={{ width: '100%' }}
            />
            <Button
              label="Done"
              variant="secondary"
              onPress={onClose}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingTop: 10,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  flex: { flex: 1 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    gap: 8,
    marginTop: -8,
  },
  flameCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  streakTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  streakSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 290,
  },
  todayCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  todayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  countValue: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
  weekTrackSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  weekBubblesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLetter: {
    fontSize: 11,
  },
  buttonGroup: {
    gap: 8,
    marginTop: 4,
  },
});
