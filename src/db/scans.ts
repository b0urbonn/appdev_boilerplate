// Manual scan results staged on the Scan tab. Media lives in
// documentDirectory/scans/ so "Clear chat" (attachments/) doesn't wipe it.
import { deleteAllScanMedia } from '@/attachments/files';
import { isOwnedMediaFile } from '@/attachments/ownedFile';
import { getDb } from '@/db/client';
import { deleteFindingCrops } from '@/attachments/regionCrops';
import * as FileSystem from 'expo-file-system/legacy';
import type { MonitorFinding } from '@/monitor/native';

export type ScanKind = 'image' | 'video' | 'audio' | 'text';
export type ScanVerdict = 'deepfake' | 'ai_generated' | 'harmful' | 'safe';

export interface Scan {
  id: string;
  kind: ScanKind;
  mediaUri: string | null;
  text: string | null;
  verdict: ScanVerdict;
  confidence: number;
  summary: string;
  findings: MonitorFinding[];
  provider: string | null;
  createdAt: number;
}

interface Row {
  id: string;
  kind: ScanKind;
  media_uri: string | null;
  text: string | null;
  verdict: string;
  confidence: number;
  summary: string;
  findings: string;
  provider: string | null;
  created_at: number;
}

function toScan(row: Row): Scan {
  let findings: MonitorFinding[] = [];
  try {
    const parsed = JSON.parse(row.findings);
    if (Array.isArray(parsed)) findings = parsed;
  } catch {}
  return {
    id: row.id,
    kind: row.kind,
    mediaUri: row.media_uri,
    text: row.text,
    verdict: row.verdict as ScanVerdict,
    confidence: row.confidence,
    summary: row.summary,
    findings,
    provider: row.provider,
    createdAt: row.created_at,
  };
}

export async function insertScan(s: Scan): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO scans
      (id, kind, media_uri, text, verdict, confidence, summary, findings, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.id, s.kind, s.mediaUri, s.text, s.verdict, s.confidence, s.summary,
    JSON.stringify(s.findings), s.provider, s.createdAt
  );
}

export async function listScans(): Promise<Scan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM scans ORDER BY created_at DESC');
  return rows.map(toScan);
}

export async function getScan(id: string): Promise<Scan | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>('SELECT * FROM scans WHERE id = ?', id);
  return row ? toScan(row) : null;
}

export async function deleteScan(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ media_uri: string | null; findings: string }>(
    'SELECT media_uri, findings FROM scans WHERE id = ?', id
  );
  if (row?.media_uri && isOwnedMediaFile(row.media_uri, `${FileSystem.documentDirectory}scans/`)) {
    await FileSystem.deleteAsync(row.media_uri, { idempotent: true }).catch(() => {});
  }
  await db.runAsync('DELETE FROM scans WHERE id = ?', id);
  if (row) { try { await deleteFindingCrops(JSON.parse(row.findings)); } catch {} }
}

export async function clearAllScans(): Promise<void> {
  const db = await getDb();
  const cropRows = await db.getAllAsync<{ findings: string }>('SELECT findings FROM scans');
  await db.runAsync('DELETE FROM scans');
  for (const row of cropRows) { try { await deleteFindingCrops(JSON.parse(row.findings)); } catch {} }
  await deleteAllScanMedia();
}
