import * as FileSystem from 'expo-file-system/legacy';
import { cropDetectedRegions, type MonitorFinding } from '@/monitor/native';
import { isOwnedMediaFile } from './ownedFile';

const directory = () => `${FileSystem.documentDirectory}detection-crops/`;

export async function cropFindingRegions(uri: string | undefined, findings: MonitorFinding[]): Promise<MonitorFinding[]> {
  const localized = findings.map((finding, index) => ({ finding, index })).filter(item => item.finding.region).slice(0, 4);
  if (!uri?.startsWith('file://') || !localized.length) return findings;
  try {
    const crops = await cropDetectedRegions(uri, localized.map(item => item.finding.region!));
    return findings.map((finding, index) => {
      const crop = crops[localized.findIndex(item => item.index === index)];
      return crop && isOwnedMediaFile(crop, directory()) ? { ...finding, cropUri: crop } : finding;
    });
  } catch { return findings; } // A crop failure must never discard the actual verdict.
}

export async function deleteFindingCrops(findings: unknown): Promise<void> {
  if (!Array.isArray(findings)) return;
  await Promise.all(findings.slice(0, 100).map(async finding => {
    const uri = finding?.cropUri;
    if (typeof uri === 'string' && isOwnedMediaFile(uri, directory())) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }));
}
