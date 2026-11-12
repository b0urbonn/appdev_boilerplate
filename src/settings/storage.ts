import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AppLanguage } from '@/i18n';

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
  dailyReminders: 'dailyReminders',
  reminderTime: 'reminderTime',
  soundEffects: 'soundEffects',
  theme: 'theme',
  language: 'language',
  modelResumeData: 'modelResumeData',
} as const;

const API_KEY_KEY = 'gemini_api_key';

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';
const RESPONSE_REQUIREMENT =
  'Always respond to every user message. Address each question and requested item. If something is unclear, answer what you can and ask a focused clarifying question. If you do not know, say so; never silently omit a question or return an empty response.';
/** 'auto' = pick the best model the API key can use (see pickBestModel). */
export const DEFAULT_GEMINI_MODEL = 'auto';

export interface Settings {
  provider: ProviderId;
  geminiApiKey: string;
  geminiModel: string;
  localBackend: LocalBackend;
  systemPrompt: string;
  nickname: string;
  onboarded: boolean;
  dailyReminders: boolean;
  reminderTime: string;
  soundEffects: boolean;
  theme: ThemeMode;
  language: AppLanguage;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'cloud',
  geminiApiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  localBackend: 'auto',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  nickname: '',
  onboarded: false,
  dailyReminders: false,
  reminderTime: '09:00',
  soundEffects: true,
  theme: 'light',
  language: 'en',
};

export async function loadSettings(): Promise<Settings> {
  const [provider, geminiModel, localBackend, systemPrompt, nickname, onboarded, dailyReminders, reminderTime, soundEffects, theme, language, apiKey] =
    await Promise.all([
      Storage.getItem(KEYS.provider),
      Storage.getItem(KEYS.geminiModel),
      Storage.getItem(KEYS.localBackend),
      Storage.getItem(KEYS.systemPrompt),
      Storage.getItem(KEYS.nickname),
      Storage.getItem(KEYS.onboarded),
      Storage.getItem(KEYS.dailyReminders),
      Storage.getItem(KEYS.reminderTime),
      Storage.getItem(KEYS.soundEffects),
      Storage.getItem(KEYS.theme),
      Storage.getItem(KEYS.language),
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
    dailyReminders: dailyReminders === 'true',
    reminderTime: reminderTime ?? '09:00',
    soundEffects: soundEffects !== 'false',
    theme: theme === 'dark' ? 'dark' : 'light',
    language: language === 'tl' ? 'tl' : 'en',
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
    case 'dailyReminders':
      return Storage.setItemAsync(KEYS.dailyReminders, String(value));
    case 'reminderTime':
      return Storage.setItemAsync(KEYS.reminderTime, value as string);
    case 'soundEffects':
      return Storage.setItemAsync(KEYS.soundEffects, String(value));
    case 'theme':
      return Storage.setItemAsync(KEYS.theme, value as string);
    case 'language':
      return Storage.setItemAsync(KEYS.language, value as AppLanguage);
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
  return [
    settings.systemPrompt,
    name ? `The user's name is ${name}.` : '',
    RESPONSE_REQUIREMENT,
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
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
