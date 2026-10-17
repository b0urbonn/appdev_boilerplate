import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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

  const requestId = useRef(0);
  const inFlight = useRef<{ packages: string[]; promise: Promise<void> } | null>(null);
  const reload = useCallback(() => {
    if (inFlight.current?.packages === packages) return inFlight.current.promise;
    const request = ++requestId.current;
    const promise = (async () => {
      const starts = recentDayStarts();
      const access = hasUsageAccess();
      const [alerts, usage] = await Promise.all([
        countDetectionsPerDay(starts),
        access && packages.length > 0 ? getDailyUsage(packages, starts) : starts.map(() => 0),
      ]);
      if (request !== requestId.current) return;
      setUsageAccess(access);
      setDays(starts.map((start, i) => ({ start, screenMs: usage[i] ?? 0, alerts: alerts[i] ?? 0 })));
    })().finally(() => {
      if (inFlight.current?.promise === promise) inFlight.current = null;
    });
    inFlight.current = { packages, promise };
    return promise;
  }, [packages]);

  useFocusEffect(useCallback(() => {
    void reload().catch(() => {});
    // Only the visible screen needs a usage refresh when the app resumes.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void reload().catch(() => {});
    });
    return () => sub.remove();
  }, [reload]));

  return { days, usageAccess, reload };
}

export function formatMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
