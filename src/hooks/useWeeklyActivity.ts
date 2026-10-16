import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { countDetectionsPerDay } from '@/db/detections';
import { getDailyUsage, hasUsageAccess } from '@/monitor/native';

export interface DayActivity {
  /** Local midnight. */
  start: number;
  /** Foreground time in protected apps. */
  screenMs: number;
  alerts: number;
}

/** Local midnights for the last `days` days, oldest first, ending today. */
export function recentDayStarts(days = 7): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return d.getTime();
  });
}

/** Last 7 days of protected-app screen time and alert counts; refreshes on focus and app resume. */
export function useWeeklyActivity(packages: string[]) {
  const [days, setDays] = useState<DayActivity[] | null>(null);
  const [usageAccess, setUsageAccess] = useState(false);

  const reload = useCallback(async () => {
    const starts = recentDayStarts();
    const access = hasUsageAccess();
    const [alerts, usage] = await Promise.all([
      countDetectionsPerDay(starts),
      access && packages.length > 0 ? getDailyUsage(packages, starts) : starts.map(() => 0),
    ]);
    setUsageAccess(access);
    setDays(starts.map((start, i) => ({ start, screenMs: usage[i] ?? 0, alerts: alerts[i] ?? 0 })));
  }, [packages]);

  useFocusEffect(
    useCallback(() => {
      reload().catch(() => {});
    }, [reload])
  );

  // Coming back from Settings > Usage access.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload().catch(() => {});
    });
    return () => sub.remove();
  }, [reload]);

  return { days, usageAccess, reload };
}

export function formatMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
