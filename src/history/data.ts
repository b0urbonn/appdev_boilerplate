import type { Detection } from '@/db/detections';
import type { Scan } from '@/db/scans';

export type HistoryFilter = 'all' | 'alerts' | 'scans';
export type HistoryItem = (
  { kind: 'alert'; detection: Detection; at: number; key: string }
  | { kind: 'scan'; scan: Scan; at: number; key: string }
) & { sample?: true };
export interface HistoryDay {
  start: number;
  screenMinutes: number | null;
  alerts: number;
  scans: number;
  items: HistoryItem[];
}

/** Eight calendar boundaries close all seven buckets, including historical weeks. */
export function historyWeekStarts(today: number, weekOffset = 0): number[] {
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6 + weekOffset * 7 + index);
    return date.getTime();
  });
}

export function buildHistoryDays(
  starts: number[],
  detections: Detection[],
  scans: Scan[],
  usageMs: number[] | null,
): HistoryDay[] {
  const items = mergeHistoryItems(detections, scans);
  return starts.slice(0, -1).map((start, index) => {
    const dayItems = items.filter(item => item.at >= start && item.at < starts[index + 1]);
    return {
      start,
      screenMinutes: usageMs === null ? null : Math.max(0, Math.round((usageMs[index] ?? 0) / 60000)),
      alerts: dayItems.filter(item => item.kind === 'alert').length,
      scans: dayItems.filter(item => item.kind === 'scan').length,
      items: dayItems,
    };
  });
}

/** Merge the same persisted records used by the Alerts and Scan result screens. */
export function mergeHistoryItems(detections: Detection[], scans: Scan[]): HistoryItem[] {
  return [
    ...detections.map(detection => ({ kind: 'alert' as const, detection, at: detection.createdAt, key: `a-${detection.id}` })),
    ...scans.map(scan => ({ kind: 'scan' as const, scan, at: scan.createdAt, key: `s-${scan.id}` })),
  ].sort((a, b) => b.at - a.at);
}

export function localDayStart(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function nextLocalDay(timestamp: number, offset = 1): number {
  const date = new Date(localDayStart(timestamp));
  date.setDate(date.getDate() + offset);
  return date.getTime();
}

export function historyForDay(items: HistoryItem[], start: number): HistoryItem[] {
  const end = nextLocalDay(start);
  return items.filter(item => item.at >= start && item.at < end);
}

export function filterHistory(items: HistoryItem[], filter: HistoryFilter): HistoryItem[] {
  return items.filter(item => filter === 'all' || item.kind === (filter === 'alerts' ? 'alert' : 'scan'));
}

export interface HistoryStreakInfo {
  streak: number;
  todayCount: number;
  todayAlerts: number;
  todayScans: number;
  activeToday: boolean;
  historyDays: { start: number; active: boolean; alerts: number; scans: number }[];
}

/**
 * Calculates safety streak based strictly on daily alert and detected scan counts
 * as recorded on the History page. Screen time is excluded.
 */
export function calculateHistoryStreak(
  detections: Pick<Detection, 'createdAt'>[],
  scans: Pick<Scan, 'createdAt'>[],
  todayTimestamp = Date.now(),
): HistoryStreakInfo {
  const todayStart = localDayStart(todayTimestamp);
  const dayMap = new Map<number, { alerts: number; scans: number }>();
  const add = (createdAt: number, kind: 'alerts' | 'scans') => {
    const day = localDayStart(createdAt);
    const stats = dayMap.get(day) ?? { alerts: 0, scans: 0 };
    stats[kind]++;
    dayMap.set(day, stats);
  };
  // Counting does not require merging, copying, or sorting the full history.
  for (const item of detections) add(item.createdAt, 'alerts');
  for (const item of scans) add(item.createdAt, 'scans');

  const todayStats = dayMap.get(todayStart) ?? { alerts: 0, scans: 0 };
  const todayCount = todayStats.alerts + todayStats.scans;
  const activeToday = todayCount > 0;

  let streak = 0;
  let currentDay = activeToday ? todayStart : nextLocalDay(todayStart, -1);

  while (true) {
    const stats = dayMap.get(currentDay);
    const count = (stats?.alerts ?? 0) + (stats?.scans ?? 0);
    if (count > 0) {
      streak += 1;
      currentDay = nextLocalDay(currentDay, -1);
    } else {
      break;
    }
  }

  const historyDays: { start: number; active: boolean; alerts: number; scans: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = nextLocalDay(todayStart, -i);
    const stats = dayMap.get(dayStart) ?? { alerts: 0, scans: 0 };
    historyDays.push({
      start: dayStart,
      active: stats.alerts + stats.scans > 0,
      alerts: stats.alerts,
      scans: stats.scans,
    });
  }

  return {
    streak,
    todayCount,
    todayAlerts: todayStats.alerts,
    todayScans: todayStats.scans,
    activeToday,
    historyDays,
  };
}
