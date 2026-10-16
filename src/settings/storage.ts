import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ProviderId = 'cloud' | 'local';
export type LocalBackend = 'auto' | 'npu' | 'gpu' | 'cpu';
export type ThemeMode = 'light' | 'dark';

const KEYS = {
  provider: 'provider',
  geminiModel: 'geminiModel',
  localBackend: 'localBackend',
  systemPrompt: 'systemPrompt',
  nickname: 'nickname',
  onboarded: 'onboarded',
  theme: 'theme',
  modelResumeData: 'modelResumeData',
  monitoredApps: 'monitoredApps',
  monitoringEnabled: 'monitoringEnabled',
  alertsSeenAt: 'alertsSeenAt',
  appLockEnabled: 'appLockEnabled',
  appLockTimeout: 'appLockTimeout',
} as const;

export type AppLockTimeout = 'immediate' | '1m' | '5m';

const API_KEY_KEY = 'gemini_api_key';

export const DEFAULT_SYSTEM_PROMPT = `You are Maalam, an AI safety analyst that detects deepfakes and harmful content.

When the user sends an image, inspect it for signs of AI generation or manipulation: warped or asymmetric facial features, plastic or overly smooth skin, blurry or inconsistent edges around the face/hair, distorted hands, teeth or eyes, mismatched lighting or shadows, background warping, garbled text or logos. Reply with a verdict first - LIKELY DEEPFAKE, POSSIBLY MANIPULATED, LIKELY AUTHENTIC or UNCERTAIN - then a confidence note and the specific artifacts you observed. Image analysis is heuristic, so never claim certainty.

When the user sends text, classify it for harmful content: hate speech, threats or violence, harassment, sexual exploitation, self-harm, scams or fraud, dangerous misinformation. State the verdict first (SAFE, CAUTION or HARMFUL), the category if any, a severity level (low/medium/high) and a one-line explanation.

For voice recordings, assess whether the audio sounds synthetic or manipulated and check the spoken content for the same harmful categories.

Be concise, factual and calm. If the request is unrelated to detecting deepfakes or harmful content, answer briefly and remind the user what Maalam is for.`;
/** 'auto' = pick the best model the API key can use (see pickBestModel). */
export const DEFAULT_GEMINI_MODEL = 'auto';

export interface MonitoredApp {
  packageName: string;
  label: string;
}

export interface Settings {
  provider: ProviderId;
  geminiApiKey: string;
  geminiModel: string;
  localBackend: LocalBackend;
  systemPrompt: string;
  nickname: string;
  onboarded: boolean;
  theme: ThemeMode;
  monitoredApps: MonitoredApp[];
  monitoringEnabled: boolean;
  /** Alerts newer than this timestamp count as unread. */
  alertsSeenAt: number;
  appLockEnabled: boolean;
  appLockTimeout: AppLockTimeout;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'cloud',
  geminiApiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  localBackend: 'auto',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  nickname: '',
  onboarded: false,
  theme: 'light',
  monitoredApps: [],
  monitoringEnabled: true,
  alertsSeenAt: 0,
  appLockEnabled: false,
  appLockTimeout: 'immediate',
};

export async function loadSettings(): Promise<Settings> {
  const [provider, geminiModel, localBackend, systemPrompt, nickname, onboarded, theme, monitoredApps, monitoringEnabled, alertsSeenAt, appLockEnabled, appLockTimeout, apiKey] =
    await Promise.all([
      Storage.getItem(KEYS.provider),
      Storage.getItem(KEYS.geminiModel),
      Storage.getItem(KEYS.localBackend),
      Storage.getItem(KEYS.systemPrompt),
      Storage.getItem(KEYS.nickname),
      Storage.getItem(KEYS.onboarded),
      Storage.getItem(KEYS.theme),
      Storage.getItem(KEYS.monitoredApps),
      Storage.getItem(KEYS.monitoringEnabled),
      Storage.getItem(KEYS.alertsSeenAt),
      Storage.getItem(KEYS.appLockEnabled),
      Storage.getItem(KEYS.appLockTimeout),
      Platform.OS === 'web'
        ? Promise.resolve(typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(API_KEY_KEY))
        : SecureStore.getItemAsync(API_KEY_KEY),
    ]);
  return {
    provider: provider === 'local' ? 'local' : 'cloud',
    geminiApiKey: apiKey ?? '',
    geminiModel: geminiModel || DEFAULT_GEMINI_MODEL,
    localBackend:
      localBackend === 'npu' || localBackend === 'gpu' || localBackend === 'cpu'
        ? localBackend
        : 'auto',
    systemPrompt: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    nickname: nickname ?? '',
    onboarded: onboarded === 'true',
    theme: theme === 'dark' ? 'dark' : 'light',
    monitoredApps: parseMonitoredApps(monitoredApps),
    monitoringEnabled: monitoringEnabled !== 'false',
    alertsSeenAt: Number(alertsSeenAt) || 0,
    appLockEnabled: appLockEnabled === 'true',
    appLockTimeout: (appLockTimeout === '1m' || appLockTimeout === '5m') ? appLockTimeout : 'immediate',
  };
}

export async function saveSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  switch (key) {
    case 'geminiApiKey':
      // Browser keys live in this tab's session only; native keys use SecureStore.
      if (Platform.OS === 'web') {
        if (value) sessionStorage.setItem(API_KEY_KEY, value as string);
        else sessionStorage.removeItem(API_KEY_KEY);
        return;
      }
      if (value) {
        await SecureStore.setItemAsync(API_KEY_KEY, value as string);
      } else {
        await SecureStore.deleteItemAsync(API_KEY_KEY);
      }
      return;
    case 'provider':
      return Storage.setItemAsync(KEYS.provider, value as string);
    case 'geminiModel':
      return Storage.setItemAsync(KEYS.geminiModel, value as string);
    case 'localBackend':
      return Storage.setItemAsync(KEYS.localBackend, value as string);
    case 'systemPrompt':
      return Storage.setItemAsync(KEYS.systemPrompt, value as string);
    case 'nickname':
      return Storage.setItemAsync(KEYS.nickname, value as string);
    case 'onboarded':
      return Storage.setItemAsync(KEYS.onboarded, String(value));
    case 'theme':
      return Storage.setItemAsync(KEYS.theme, value as string);
    case 'monitoredApps':
      return Storage.setItemAsync(KEYS.monitoredApps, JSON.stringify(value));
    case 'monitoringEnabled':
      return Storage.setItemAsync(KEYS.monitoringEnabled, String(value));
    case 'alertsSeenAt':
      return Storage.setItemAsync(KEYS.alertsSeenAt, String(value));
    case 'appLockEnabled':
      return Storage.setItemAsync(KEYS.appLockEnabled, String(value));
    case 'appLockTimeout':
      return Storage.setItemAsync(KEYS.appLockTimeout, value as string);
  }
}

function parseMonitoredApps(raw: string | null): MonitoredApp[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is MonitoredApp =>
        typeof a === 'object' && a !== null &&
        typeof a.packageName === 'string' && typeof a.label === 'string'
    );
  } catch {
    return [];
  }
}

/** Pause/resume state for an interrupted model download (opaque JSON). */
/** Erase every saved setting (including the API key). */
export async function resetSettings(): Promise<void> {
  await Storage.clearAsync();
  await saveSetting('geminiApiKey', '');
}

/** System prompt sent to the AI, personalised with the user's nickname. */
export function buildSystemPrompt(settings: Settings): string {
  const name = settings.nickname.trim();
  return name
    ? `${settings.systemPrompt}\nThe user's name is ${name}.`.trim()
    : settings.systemPrompt;
}

export async function getModelResumeData(): Promise<string | null> {
  return Storage.getItem(KEYS.modelResumeData);
}

export async function setModelResumeData(data: string | null): Promise<void> {
  if (data) {
    await Storage.setItemAsync(KEYS.modelResumeData, data);
  } else {
    await Storage.removeItemAsync(KEYS.modelResumeData);
  }
}
