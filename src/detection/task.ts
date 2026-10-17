// Headless JS task ("MaalamScan") started by MaalamScanTaskService for each
// captured frame. Analyses the frame, stores flagged detections in SQLite
// and reports the verdict back to the native monitor service.
import * as FileSystem from 'expo-file-system/legacy';
import { cropFindingRegions, deleteFindingCrops } from '@/attachments/regionCrops';
import { getDb, newId } from '@/db/client';
import { detectionsDir, insertDetection } from '@/db/detections';
import { refreshModelStatus } from '@/ai/local';
import { analyzeFrame, type MonitorFrame } from '@/detection/analyze';
import { quickChat } from '@/detection/quickChat';
import type { ChatMessage } from '@/ai';
import { reportQuickReply, reportResult, type MonitorFinding } from '@/monitor/native';
import { loadSettings } from '@/settings/storage';

export default async function maalamScanTask(data: MonitorFrame & { mode?: string; prompt?: string; history?: string; attachmentUri?: string; attachmentKind?: string }): Promise<void> {
  const frameId = data?.frameId;
  if (!frameId) return;
  if (data.mode === 'quickChat') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 110_000);
    try {
      const settings = await loadSettings();
      if (!settings.onboarded) throw new Error('Complete setup in Maalam first.');
      const raw: unknown = JSON.parse(data.history || '[]');
      const history: ChatMessage[] = Array.isArray(raw) ? raw.filter((m): m is ChatMessage =>
        m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-6) : [];
      const attachment: Partial<ChatMessage> = {};
      if (data.attachmentUri) {
        const directory = `${FileSystem.cacheDirectory}monitor-attachments/`;
        const name = data.attachmentUri.slice(directory.length);
        if (!data.attachmentUri.startsWith(directory) || !/^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(name)) throw new Error('Attachment is unavailable. Choose the file again.');
        if (data.attachmentKind === 'image') attachment.imageUri = data.attachmentUri;
        else if (data.attachmentKind === 'video') attachment.videoUri = data.attachmentUri;
        else if (data.attachmentKind === 'audio') attachment.audioUri = data.attachmentUri;
        else throw new Error('Unsupported attachment type.');
      }
      const reply = await quickChat((data.prompt || '').slice(0, 5000), history, settings, frameId, controller.signal, attachment);
      reportQuickReply(frameId, reply, null);
    } catch (e) {
      reportQuickReply(frameId, null, e instanceof Error ? e.message : 'Unable to check this content.');
    } finally {
      clearTimeout(timeout);
    }
    return;
  }
  const controller = new AbortController();
  let croppedFindings: MonitorFinding[] = [];
  let persisted = false;
  const timeout = setTimeout(() => controller.abort(), 110_000);
  try {
    await getDb();
    const settings = await loadSettings();
    const userStartedScreenShare = data.mode === 'screenShare';
    if (!settings.onboarded || (!userStartedScreenShare &&
        (!settings.monitoringEnabled || !settings.monitoredApps.some(app => app.packageName === data.packageName)))) {
      reportResult(frameId, null);
      return;
    }
    // Headless runs skip the UI's model-status refresh, so re-read it here.
    if (settings.provider === 'local') await refreshModelStatus();
    const result = await analyzeFrame(data, settings, controller.signal);
    if (!result) {
      reportResult(frameId, null);
      return;
    }
    croppedFindings = await cropFindingRegions(data.imageUri, result.findings);
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
      findings: croppedFindings,
      screenshotUri,
      screenText: data.screenText ?? null,
      provider: settings.provider,
      createdAt: typeof data.capturedAt === 'number' ? data.capturedAt : Date.now(),
    });
    persisted = true;
    reportResult(frameId, { detectionId, ...result, findings: croppedFindings });
  } catch (e) {
    console.warn('MaalamScan failed:', e);
    reportResult(frameId, null, e instanceof Error ? e.message : 'Screen check failed.');
  } finally {
    clearTimeout(timeout);
    if (!persisted) await deleteFindingCrops(croppedFindings);
    if (data?.imageUri?.startsWith(FileSystem.cacheDirectory ?? 'file://')) {
      await FileSystem.deleteAsync(data.imageUri, { idempotent: true }).catch(() => {});
    }
  }
}
