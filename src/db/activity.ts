import { getDb } from './client';

/** Home streaks need timestamps, never saved screenshots, transcripts, or media. */
export async function getHistoryActivity() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ createdAt: number; kind: 'alert' | 'scan' }>(`
    SELECT created_at AS createdAt, 'alert' AS kind FROM detections
    UNION ALL
    SELECT created_at AS createdAt, 'scan' AS kind FROM scans
  `);
  const detections: { createdAt: number }[] = [];
  const scans: { createdAt: number }[] = [];
  for (const row of rows) (row.kind === 'alert' ? detections : scans).push({ createdAt: row.createdAt });
  return { detections, scans };
}
