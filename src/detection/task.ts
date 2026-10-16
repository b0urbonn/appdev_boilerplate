// Headless JS task ("MaalamScan") started by MaalamScanTaskService for each
// captured frame. Analyses the frame, stores flagged detections in SQLite
// and reports the verdict back to the native monitor service.
import * as FileSystem from 'expo-file-system/legacy';
import { getDb, newId } from '@/db/client';
import { detectionsDir, insertDetection } from '@/db/detections';
import { refreshModelStatus } from '@/ai/local';
import { analyzeFrame, type MonitorFrame } from '@/detection/analyze';
import { reportResult } from '@/monitor/native';
import { loadSettings } from '@/settings/storage';

export default async function maalamScanTask(data: MonitorFrame): Promise<void> {
  const frameId = data?.frameId;
  if (!frameId) return;
  try {
    await getDb();
    const settings = await loadSettings();
    if (!settings.onboarded || !settings.monitoringEnabled ||
        settings.monitoredApps.length === 0) {
      reportResult(frameId, null);
      return;
    }
    // Headless runs skip the UI's model-status refresh, so re-read it here.
    if (settings.provider === 'local') await refreshModelStatus();
    const result = await analyzeFrame(data, settings);
    if (!result) {
      reportResult(frameId, null);
      return;
    }
    const detectionId = newId();
    let screenshotUri: string | null = null;
    if (data.imageUri?.startsWith('file://')) {
      screenshotUri = `${detectionsDir()}${detectionId}.jpg`;
      await FileSystem.makeDirectoryAsync(detectionsDir(), { intermediates: true }).catch(() => {});
      await FileSystem.moveAsync({ from: data.imageUri, to: screenshotUri }).catch(() => {
        screenshotUri = null;
      });
    }
    await insertDetection({
      id: detectionId,
      packageName: data.packageName ?? '',
      appLabel: data.appLabel ?? data.packageName ?? '',
      verdict: result.verdict,
      confidence: result.confidence,
      summary: result.summary,
      findings: result.findings,
      screenshotUri,
      screenText: data.screenText ?? null,
      provider: settings.provider,
      createdAt: typeof data.capturedAt === 'number' ? data.capturedAt : Date.now(),
    });
    reportResult(frameId, { detectionId, ...result });
  } catch (e) {
    console.warn('MaalamScan failed:', e);
    reportResult(frameId, null);
  } finally {
    if (data?.imageUri?.startsWith(FileSystem.cacheDirectory ?? 'file://')) {
      await FileSystem.deleteAsync(data.imageUri, { idempotent: true }).catch(() => {});
    }
  }
}
