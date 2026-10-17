// Web stand-in for native.ts: protected-app monitoring is Android-only, so
// this module serves demo data that lets the monitor UI be previewed in the
// browser.
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
}

function svgIcon(letter: string, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">` +
    `<rect width="96" height="96" rx="22" fill="${color}"/>` +
    `<text x="48" y="64" font-family="sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle">${letter}</text>` +
    `</svg>`;
  // Keep the markup raw: RN-web's Image re-encodes `;utf8,` SVG URIs itself
  // (double-encoding breaks the load). See react-native-web svgDataUriPattern.
  return `data:image/svg+xml;utf8,${svg}`;
}

const DEMO_APPS: InstalledApp[] = [
  { packageName: 'com.zhiliaoapp.musically', label: 'TikTok', iconUri: svgIcon('T', '#111111') },
  { packageName: 'com.facebook.katana', label: 'Facebook', iconUri: svgIcon('F', '#1877F2') },
  { packageName: 'com.instagram.android', label: 'Instagram', iconUri: svgIcon('I', '#C13584') },
  { packageName: 'com.google.android.youtube', label: 'YouTube', iconUri: svgIcon('Y', '#FF0000') },
  { packageName: 'com.facebook.orca', label: 'Messenger', iconUri: svgIcon('M', '#00B2FF') },
  { packageName: 'com.twitter.android', label: 'X', iconUri: svgIcon('X', '#14171A') },
  { packageName: 'org.telegram.messenger', label: 'Telegram', iconUri: svgIcon('T', '#26A5E4') },
  { packageName: 'com.whatsapp', label: 'WhatsApp', iconUri: svgIcon('W', '#25D366') },
];

// Pretend the accessibility service was enabled from the onboarding step.
let simulatedServiceOn = false;

export const supportsAppMonitor = true;

export async function getInstalledApps(): Promise<InstalledApp[]> {
  return DEMO_APPS;
}

/** Demo icons are inline SVG data URLs, not cached files. */
export function appIconUri(packageName: string): string {
  return DEMO_APPS.find((a) => a.packageName === packageName)?.iconUri ?? '';
}

export async function launchApp(packageName: string): Promise<boolean> {
  const label = DEMO_APPS.find((a) => a.packageName === packageName)?.label ?? packageName;
  window.alert(`On Android this opens ${label}.`);
  return true;
}

export function isMonitorServiceEnabled(): boolean {
  return simulatedServiceOn;
}

export function supportsScreenshots(): boolean {
  return true;
}

export function openAccessibilitySettings(): void {
  simulatedServiceOn = true;
}

export function setMonitorConfig(_config: MonitorConfig): void {}

export function reportResult(_frameId: string, _result: MonitorResult | null, _error?: string): void {}

let simulatedUsageAccess = false;

export function hasUsageAccess(): boolean {
  return simulatedUsageAccess;
}

export function openUsageAccessSettings(): boolean {
  simulatedUsageAccess = true;
  return true;
}

/** Deterministic demo minutes per app per day so the chart has a stable shape. */
export async function getDailyUsage(packages: string[], dayStarts: number[]): Promise<number[]> {
  if (!simulatedUsageAccess) return dayStarts.map(() => 0);
  return dayStarts.map((start) => {
    const day = Math.floor(start / 86400000);
    return packages.length * (18 + ((day * 37) % 41)) * 60000;
  });
}

export function reportQuickReply(_requestId: string, _reply: string | null, _error: string | null): void {}

export function getMonitorServiceStatus(): { enabled: boolean; connected: boolean; sharing: boolean } {
  return { enabled: simulatedServiceOn, connected: simulatedServiceOn, sharing: false };
}

export async function requestScreenShare(): Promise<boolean> {
  return false;
}

export function stopScreenShare(): void {}

export async function cropDetectedRegions(_uri: string, _regions: DetectedRegion[]): Promise<(string | null)[]> { return []; }

export async function readClipboardText(): Promise<string> {
  return navigator.clipboard.readText();
}

export async function captureScreenOnce(): Promise<string | null> { return null; }
