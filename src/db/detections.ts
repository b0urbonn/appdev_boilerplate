// Detections flagged by the protected-app monitor. Flagged screenshots are
// moved into documentDirectory/detections/ and removed again on delete.
import * as FileSystem from 'expo-file-system/legacy';
import { getDb } from '@/db/client';
import type { MonitorFinding } from '@/monitor/native';

export const detectionsDir = () => `${FileSystem.documentDirectory}detections/`;

/** Human-readable verdict label shared by the home banner, list and detail. */
export function verdictLabel(verdict: Detection['verdict'] | 'safe' | string): string {
  switch (verdict) {
    case 'safe': return 'Looks safe';
    case 'deepfake': return 'Deepfake';
    case 'ai_generated': return 'AI-generated';
    case 'harmful': return 'Harmful content';
    default: return 'Flagged';
  }
}

export interface Detection {
  id: string;
  packageName: string;
  appLabel: string;
  verdict: 'deepfake' | 'ai_generated' | 'harmful';
  confidence: number;
  summary: string;
  findings: MonitorFinding[];
  screenshotUri: string | null;
  screenText: string | null;
  provider: string | null;
  createdAt: number;
}

interface Row {
  id: string;
  package_name: string;
  app_label: string;
  verdict: string;
  confidence: number;
  summary: string;
  findings: string;
  screenshot_uri: string | null;
  screen_text: string | null;
  provider: string | null;
  created_at: number;
}

function toDetection(row: Row): Detection {
  let findings: MonitorFinding[] = [];
  try {
    const parsed = JSON.parse(row.findings);
    if (Array.isArray(parsed)) findings = parsed;
  } catch {}
  return {
    id: row.id,
    packageName: row.package_name,
    appLabel: row.app_label,
    verdict: row.verdict as Detection['verdict'],
    confidence: row.confidence,
    summary: row.summary,
    findings,
    screenshotUri: row.screenshot_uri,
    screenText: row.screen_text,
    provider: row.provider,
    createdAt: row.created_at,
  };
}

export async function insertDetection(d: Detection): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO detections
      (id, package_name, app_label, verdict, confidence, summary, findings,
       screenshot_uri, screen_text, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    d.id, d.packageName, d.appLabel, d.verdict, d.confidence, d.summary,
    JSON.stringify(d.findings), d.screenshotUri, d.screenText, d.provider,
    d.createdAt
  );
}

export async function listDetections(limit?: number): Promise<Detection[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM detections ORDER BY created_at DESC${limit ? ` LIMIT ${limit}` : ''}`
  );
  return rows.map(toDetection);
}

export async function getDetection(id: string): Promise<Detection | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    'SELECT * FROM detections WHERE id = ?', id
  );
  return row ? toDetection(row) : null;
}

export async function deleteDetection(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ screenshot_uri: string | null }>(
    'SELECT screenshot_uri FROM detections WHERE id = ?', id
  );
  if (row?.screenshot_uri?.startsWith(detectionsDir())) {
    await FileSystem.deleteAsync(row.screenshot_uri, { idempotent: true }).catch(() => {});
  }
  await db.runAsync('DELETE FROM detections WHERE id = ?', id);
}

export async function clearAllDetections(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM detections');
  await FileSystem.deleteAsync(detectionsDir(), { idempotent: true }).catch(() => {});
}

export async function countDetectionsSince(ts: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM detections WHERE created_at > ?', ts
  );
  return row?.n ?? 0;
}

/** Alert count per bucket; `dayStarts` are ascending, the last bucket is open-ended. */
export async function countDetectionsPerDay(dayStarts: number[]): Promise<number[]> {
  if (dayStarts.length === 0) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<{ created_at: number }>(
    'SELECT created_at FROM detections WHERE created_at >= ?', dayStarts[0]
  );
  const counts = dayStarts.map(() => 0);
  for (const { created_at } of rows) {
    let i = dayStarts.length - 1;
    while (i > 0 && created_at < dayStarts[i]) i--;
    counts[i]++;
  }
  return counts;
}

export async function listDetectionsSince(ts: number): Promise<Detection[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM detections WHERE created_at > ? ORDER BY created_at DESC', ts
  );
  return rows.map(toDetection);
}

export async function listDetectionsForApp(packageName: string): Promise<Detection[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM detections WHERE package_name = ? ORDER BY created_at DESC',
    packageName
  );
  return rows.map(toDetection);
}

export interface AppDetectionStats {
  packageName: string;
  count: number;
  lastAt: number;
}

export async function detectionStatsByApp(): Promise<AppDetectionStats[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    package_name: string;
    n: number;
    last_at: number;
  }>(
    'SELECT package_name, COUNT(*) AS n, MAX(created_at) AS last_at FROM detections GROUP BY package_name'
  );
  return rows.map((r) => ({ packageName: r.package_name, count: r.n, lastAt: r.last_at }));
}
