// Wrapper for the local "AppMonitor" Expo module: installed-app listing,
// accessibility-service state and reporting scan results back to the
// native monitor service.
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';

export interface InstalledApp {
  packageName: string;
  label: string;
  iconUri: string;
}

export interface MonitorFinding {
  category: 'deepfake' | 'ai_generated' | 'harmful';
  label: string;
  confidence: number;
  description: string;
}

export interface MonitorResult {
  detectionId: string;
  verdict: 'deepfake' | 'ai_generated' | 'harmful';
  confidence: number;
  summary: string;
  findings: MonitorFinding[];
}

export interface MonitorConfig {
  enabled: boolean;
  packages: string[];
  labels: Record<string, string>;
  minIntervalMs: number;
}

interface AppMonitorModule {
  getInstalledApps(): Promise<InstalledApp[]>;
  launchApp(packageName: string): Promise<boolean>;
  isMonitorServiceEnabled(): boolean;
  supportsScreenshots(): boolean;
  openAccessibilitySettings(): void;
  setConfig(config: MonitorConfig): void;
  reportResult(frameId: string, result: MonitorResult | null): void;
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): boolean;
  getDailyUsage(packages: string[], dayStarts: number[]): Promise<number[]>;
}

const native = requireOptionalNativeModule<AppMonitorModule>('AppMonitor');

export const supportsAppMonitor = !!native;

export async function getInstalledApps(): Promise<InstalledApp[]> {
  return native?.getInstalledApps() ?? [];
}

/** Cached 96px icon PNG written by getInstalledApps, for monitored-app rows. */
export function appIconUri(packageName: string): string {
  return `${FileSystem.cacheDirectory}app-icons/${packageName}.png`;
}

export async function launchApp(packageName: string): Promise<boolean> {
  return native?.launchApp(packageName) ?? false;
}

export function isMonitorServiceEnabled(): boolean {
  return native?.isMonitorServiceEnabled() ?? false;
}

export function supportsScreenshots(): boolean {
  return native?.supportsScreenshots() ?? false;
}

export function openAccessibilitySettings(): void {
  native?.openAccessibilitySettings();
}

export function setMonitorConfig(config: MonitorConfig): void {
  native?.setConfig(config);
}

export function reportResult(frameId: string, result: MonitorResult | null): void {
  native?.reportResult(frameId, result);
}

/** Whether the user granted Settings > Usage access (needed for screen time). */
export function hasUsageAccess(): boolean {
  return native?.hasUsageAccess() ?? false;
}

export function openUsageAccessSettings(): boolean {
  return native?.openUsageAccessSettings() ?? false;
}

/** Foreground ms in `packages` per day, one entry per local-midnight in `dayStarts`. */
export async function getDailyUsage(packages: string[], dayStarts: number[]): Promise<number[]> {
  return native?.getDailyUsage(packages, dayStarts) ?? dayStarts.map(() => 0);
}
