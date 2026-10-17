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

export interface DetectedRegion {
  /** Normalized coordinates in the captured image (0..1). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorFinding {
  category: 'deepfake' | 'ai_generated' | 'harmful';
  label: string;
  confidence: number;
  description: string;
  region?: DetectedRegion;
  cropUri?: string;
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
  /** Overlay tools popup follows the app theme (dark cards vs light cards). */
  darkTheme: boolean;
}

interface AppMonitorModule {
  captureScreenOnce?: () => Promise<string | null>;
  readClipboardText?: () => Promise<string>;
  cropDetectedRegions?: (uri: string, regions: DetectedRegion[]) => Promise<(string | null)[]>;
  getInstalledApps(): Promise<InstalledApp[]>;
  launchApp(packageName: string): Promise<boolean>;
  isMonitorServiceEnabled(): boolean;
  getMonitorServiceStatus(): { enabled: boolean; connected: boolean; sharing: boolean };
  requestScreenShare(): Promise<boolean>;
  stopScreenShare(): void;
  supportsScreenshots(): boolean;
  openAccessibilitySettings(): void;
  setConfig(config: MonitorConfig): void;
  reportResult(frameId: string, result: MonitorResult | null, error: string | null): void;
  reportQuickReply(requestId: string, reply: string | null, error: string | null): void;
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

export function reportResult(frameId: string, result: MonitorResult | null, error?: string): void {
  native?.reportResult(frameId, result, error ?? null);
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

export function reportQuickReply(requestId: string, reply: string | null, error: string | null): void {
  native?.reportQuickReply(requestId, reply, error);
}

export function getMonitorServiceStatus(): { enabled: boolean; connected: boolean; sharing: boolean } {
  return native?.getMonitorServiceStatus() ?? { enabled: false, connected: false, sharing: false };
}

/** Ask Android which app window or display Maalam may inspect for this session. */
export async function requestScreenShare(): Promise<boolean> {
  return native?.requestScreenShare() ?? false;
}

export function stopScreenShare(): void {
  native?.stopScreenShare();
}

/** Older APKs continue scanning until rebuilt with OpenCV support. */
export async function cropDetectedRegions(uri: string, regions: DetectedRegion[]): Promise<(string | null)[]> {
  return native?.cropDetectedRegions?.(uri, regions) ?? [];
}

export async function readClipboardText(): Promise<string> {
  if (!native?.readClipboardText) throw new Error('Touch and hold the message field, then choose Paste. The Paste button needs the updated APK.');
  return native.readClipboardText();
}

export async function captureScreenOnce(): Promise<string | null> {
  if (!native?.captureScreenOnce) throw new Error('This installed APK has no screen-capture button support. Install the updated APK, or attach a screenshot with Screenshot / image.');
  return native.captureScreenOnce();
}
