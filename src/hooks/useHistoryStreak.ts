import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getHistoryActivity } from '@/db/activity';
import {
  calculateHistoryStreak,
  type HistoryStreakInfo,
} from '@/history/data';

const DEFAULT_STREAK: HistoryStreakInfo = {
  streak: 0,
  todayCount: 0,
  todayAlerts: 0,
  todayScans: 0,
  activeToday: false,
  historyDays: [],
};

export function useHistoryStreak() {
  const [streakInfo, setStreakInfo] = useState<HistoryStreakInfo>(DEFAULT_STREAK);
  const [loading, setLoading] = useState(true);

  const inFlight = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const promise = (async () => {
      try {
        const { detections, scans } = await getHistoryActivity();
        setStreakInfo(calculateHistoryStreak(detections, scans));
      } catch {
        // Keep the last successful count during a transient database failure.
      } finally {
        setLoading(false);
      }
    })().finally(() => { if (inFlight.current === promise) inFlight.current = null; });
    inFlight.current = promise;
    return promise;
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]));

  return { ...streakInfo, loading, refresh };
}
