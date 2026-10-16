// Home "This week" card: paired bars per day for screen time in protected
// apps and alerts raised. Bars grow in with a stagger; tapping a day selects it.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Button } from '@/components/Button';
import { PulseRing } from '@/components/PulseRing';
import { SmoothPressable } from '@/components/SmoothPressable';
import { formatMinutes, recentDayStarts, type DayActivity } from '@/hooks/useWeeklyActivity';
import { fadeIn, layoutGlide, SPRING_BOUNCY } from '@/motion';
import { useTheme } from '@/theme';

const CHART_HEIGHT = 112;
const BAR_WIDTH = 10;
const STUB = 3;

/** Selected day reads at full strength; empty values stay faint. */
const emphasis = (selected: boolean, hasValue: boolean) =>
  !hasValue ? 0.25 : selected ? 1 : 0.6;

function Bar({ height, color, index, emphasis }: { height: number; color: string; index: number; emphasis: number }) {
  const h = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    h.set(withDelay(120 + index * 60, withSpring(height, SPRING_BOUNCY)));
  }, [h, height, index]);

  useEffect(() => {
    opacity.set(withTiming(emphasis, { duration: 200 }));
  }, [emphasis, opacity]);

  const style = useAnimatedStyle(() => ({ height: h.get(), opacity: opacity.get() }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export function ActivityChart({
  days,
  usageAccess,
  hasApps,
  onAllowUsage,
  onChooseApps,
}: {
  days: DayActivity[] | null;
  usageAccess: boolean;
  hasApps: boolean;
  onAllowUsage: () => void;
  onChooseApps: () => void;
}) {
  const theme = useTheme();
  // Render empty bars while loading so they grow in once data lands.
  const data = days ?? recentDayStarts().map((start) => ({ start, screenMs: 0, alerts: 0 }));
  const [selected, setSelected] = useState(data.length - 1);
  const showScreen = usageAccess && hasApps;

  const minutes = data.map((d) => d.screenMs / 60000);
  const maxMinutes = Math.max(...minutes, 1);
  const maxAlerts = Math.max(...data.map((d) => d.alerts), 1);
  const avgMinutes = minutes.reduce((a, b) => a + b, 0) / data.length;
  const totalAlerts = data.reduce((a, d) => a + d.alerts, 0);

  const screenColor = theme.tint;
  const alertColor = theme.danger;
  const pick = data[selected] ?? data[data.length - 1];
  const dayName = (start: number, style: 'short' | 'long') =>
    start === data[data.length - 1].start
      ? 'Today'
      : new Date(start).toLocaleDateString(undefined, { weekday: style });
  const pickMinutes = pick.screenMs / 60000;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, { color: theme.textSecondary }]}>This week</Text>
          <Text style={[styles.title, { color: theme.text }]}>Screen time & alerts</Text>
        </View>
        <View style={styles.legend}>
          <LegendDot color={screenColor} label="Time" />
          <LegendDot color={alertColor} label="Alerts" />
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.flex}>
          {showScreen ? (
            <AnimatedNumber value={avgMinutes} format={formatMinutes} style={[styles.statValue, { color: screenColor }]} />
          ) : (
            <Text style={[styles.statValue, { color: theme.textSecondary }]}>—</Text>
          )}
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>daily avg in protected apps</Text>
        </View>
        <View style={styles.flex}>
          <AnimatedNumber value={totalAlerts} style={[styles.statValue, { color: alertColor }]} />
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            alert{totalAlerts === 1 ? '' : 's'} this week
          </Text>
        </View>
      </View>

      <Animated.Text
        key={`${pick.start}-${pick.alerts}-${Math.round(pickMinutes)}`}
        entering={fadeIn()}
        style={[styles.caption, { color: theme.textSecondary }]}
      >
        <Text style={{ color: theme.text, fontWeight: '700' }}>{dayName(pick.start, 'long')}</Text>
        {showScreen ? ` · ${formatMinutes(pickMinutes)}` : ''}
        {` · ${pick.alerts} alert${pick.alerts === 1 ? '' : 's'}`}
      </Animated.Text>

      <View style={styles.plot}>
        <View pointerEvents="none" style={[styles.gridLine, { top: 0, borderColor: theme.border }]} />
        <View pointerEvents="none" style={[styles.gridLine, { top: CHART_HEIGHT / 2, borderColor: theme.border }]} />
        <View pointerEvents="none" style={[styles.gridLine, { top: CHART_HEIGHT, borderColor: theme.border }]} />
        {data.map((d, i) => {
          const isSelected = i === selected;
          const isToday = i === data.length - 1;
          const screenH = showScreen && d.screenMs > 0 ? Math.max(STUB, (minutes[i] / maxMinutes) * CHART_HEIGHT) : STUB;
          const alertH = d.alerts > 0 ? Math.max(STUB, (d.alerts / maxAlerts) * CHART_HEIGHT) : STUB;
          return (
            <SmoothPressable
              key={d.start}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${dayName(d.start, 'long')}${showScreen ? `, ${formatMinutes(minutes[i])} in protected apps` : ''}, ${d.alerts} alert${d.alerts === 1 ? '' : 's'}`}
              onPress={() => setSelected(i)}
              hitSlop={4}
              pressedScale={0.92}
              style={styles.column}
            >
              <View style={styles.bars}>
                <Bar height={screenH} color={screenColor} index={i} emphasis={emphasis(isSelected, showScreen && d.screenMs > 0)} />
                <Bar height={alertH} color={alertColor} index={i} emphasis={emphasis(isSelected, d.alerts > 0)} />
              </View>
              <View
                style={[
                  styles.dayPill,
                  isSelected && { backgroundColor: theme.buttonSecondary },
                ]}
              >
                {isToday && (
                  <View style={styles.liveDot}>
                    <PulseRing color={screenColor} radius={3} maxScale={2.4} period={2000} />
                    <View style={[styles.liveDotCore, { backgroundColor: screenColor }]} />
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.dayLabel,
                    { color: isSelected ? theme.text : theme.textSecondary, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {dayName(d.start, 'short')}
                </Text>
              </View>
            </SmoothPressable>
          );
        })}
      </View>

      {!showScreen && (
        <Animated.View
          entering={fadeIn(200)}
          layout={layoutGlide}
          style={[styles.notice, { backgroundColor: theme.background, borderColor: theme.border }]}
        >
          <Ionicons name="hourglass-outline" size={20} color={theme.tint} />
          <Text style={[styles.noticeText, { color: theme.text }]}>
            {hasApps
              ? 'Allow usage access to see time spent in your protected apps.'
              : 'Choose apps to protect to track their screen time.'}
          </Text>
          <Button
            label={hasApps ? 'Allow' : 'Choose'}
            variant="secondary"
            onPress={hasApps ? onAllowUsage : onChooseApps}
            style={styles.noticeButton}
          />
        </Animated.View>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  eyebrow: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 17, fontWeight: '700', marginTop: 2 },
  legend: { gap: 4, alignItems: 'flex-start' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: 12 },
  statValue: { fontSize: 26, lineHeight: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, lineHeight: 16 },
  caption: { fontSize: 13 },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT + 30,
    paddingBottom: 0,
  },
  gridLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed' },
  column: { flex: 1, alignItems: 'center', gap: 8 },
  bars: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: BAR_WIDTH, borderRadius: BAR_WIDTH / 2 },
  dayPill: {
    alignSelf: 'stretch',
    marginHorizontal: 2,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { position: 'absolute', top: -3, right: 1, width: 6, height: 6 },
  liveDotCore: { width: 6, height: 6, borderRadius: 3 },
  dayLabel: { fontSize: 11, flexShrink: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  noticeButton: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 14 },
});
