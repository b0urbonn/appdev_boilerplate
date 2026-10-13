// Browser stand-in for local.ts: LiteRT-LM only runs in the Android app.
import type { LocalBackend } from '../settings/storage';
import type { ModelStatus } from './local';
import type { ChatProvider } from './types';

export type { ModelStatus } from './local';
export const supportsLocalAI = false;
export const LOCAL_CONTEXT_TOKENS = 4096;

const status: ModelStatus = { state: 'not_downloaded' };
const unavailable = () =>
  new Error('Local AI requires the Android app. Use Cloud (Gemini) in the browser.');

export function getModelStatus(): ModelStatus { return status; }
export function subscribeModelStatus(listener: (value: ModelStatus) => void): () => void {
  listener(status);
  return () => {};
}
export function isModelLoaded(): boolean { return false; }
export async function refreshModelStatus(): Promise<ModelStatus> { return status; }
export async function downloadModel(): Promise<void> { throw unavailable(); }
export async function cancelDownload(): Promise<void> {}
export async function pauseDownload(): Promise<void> {}
export async function deleteModel(): Promise<void> {}
export async function loadLocalModel(_backend: LocalBackend, _systemPrompt?: string): Promise<void> {
  throw unavailable();
}
export async function unloadEngine(): Promise<void> {}
export async function releaseLocalConversation(_chatId: string): Promise<void> {}

export function createLocalProvider(_opts: {
  backend: LocalBackend;
  isModelDownloaded: () => boolean;
}): ChatProvider {
  return {
    id: 'local',
    label: 'Local (Android only)',
    requiresNetwork: false,
    async generate() { throw unavailable(); },
  };
}
