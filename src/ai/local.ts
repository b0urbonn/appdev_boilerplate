// Local provider: Gemma 4 E2B running on-device via react-native-litert-lm.
//
// Notes on the library API (verified against its .d.ts):
// - createLLM() -> LiteRTLMInstance; loadModel(path, config) loads weights.
// - createConversation() gives a logical conversation handle; it cannot be
//   seeded with prior history, so on app restart we prepend a compact
//   transcript to the first message of a resumed chat instead.
// - There is no cancel/abort API; on abort we stop consuming tokens and let
//   the native generation finish in the background.
import * as FileSystem from 'expo-file-system/legacy';
import {
  createLLM,
  GEMMA_4_E2B_IT,
  isMemoryError,
  LiteRTLMError,
  type ConversationHandle,
  type LiteRTLMInstance,
} from 'react-native-litert-lm';
import {
  getModelResumeData,
  setModelResumeData,
  type LocalBackend,
} from '../settings/storage';
import type { ChatProvider } from './types';

const MODEL_URL = GEMMA_4_E2B_IT;
export const supportsLocalAI = true;
const MODEL_FILENAME = 'gemma-4-E2B-it.litertlm';
const TMP_FILENAME = MODEL_FILENAME + '.download';
/** Context window used when loading the local model. */
export const LOCAL_CONTEXT_TOKENS = 4096;
/** Chars of prior history prepended to the first message after a restart. */
const TRANSCRIPT_BUDGET = 3000;

const modelDir = () => `${FileSystem.documentDirectory}models/`;
const modelUri = () => modelDir() + MODEL_FILENAME;
const tmpUri = () => modelDir() + TMP_FILENAME;

export type ModelStatus =
  | { state: 'not_downloaded' }
  | { state: 'downloading'; progress: number }
  | { state: 'paused'; progress: number }
  | { state: 'downloaded'; sizeBytes: number }
  | { state: 'loading' }
  | { state: 'loaded' };

type StatusListener = (s: ModelStatus) => void;

// ── Model file + engine state (module singletons) ───────────────────────────

let status: ModelStatus = { state: 'not_downloaded' };
const listeners = new Set<StatusListener>();
let activeDownload: FileSystem.DownloadResumable | null = null;

let engine: LiteRTLMInstance | null = null;
let engineBackend: string | null = null;
let engineLoading: Promise<LiteRTLMInstance> | null = null;
const conversations = new Map<string, ConversationHandle>();
// Chat ids whose first message must carry a prepended transcript.
const needsTranscript = new Set<string>();

function emit(s: ModelStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}

export function getModelStatus(): ModelStatus {
  return status;
}

export function subscribeModelStatus(l: StatusListener): () => void {
  listeners.add(l);
  l(status);
  return () => listeners.delete(l);
}

export function isModelLoaded(): boolean {
  return status.state === 'loaded';
}

/** Read the on-disk state into `status`. Call once on app start. */
export async function refreshModelStatus(): Promise<ModelStatus> {
  if (engine) {
    emit({ state: 'loaded' });
    return status;
  }
  const info = await FileSystem.getInfoAsync(modelUri());
  if (info.exists) {
    emit({ state: 'downloaded', sizeBytes: info.size ?? 0 });
  } else {
    const tmp = await FileSystem.getInfoAsync(tmpUri());
    const resume = await getModelResumeData();
    if (tmp.exists || resume) {
      emit({
        state: 'paused',
        progress: tmp.exists && tmp.size ? tmp.size / expectedSize() : 0,
      });
    } else {
      emit({ state: 'not_downloaded' });
    }
  }
  return status;
}

function expectedSize(): number {
  // ~2.58 GB as served; used only for a rough resume progress display.
  return 2.58 * 1024 * 1024 * 1024;
}

/**
 * Download the model from Settings. Downloads to a temp file and renames on
 * completion so a partial file is never treated as ready. Supports
 * cancel (keeps resume data) and resume-or-restart.
 */
export async function downloadModel(): Promise<void> {
  if (activeDownload) return;
  await FileSystem.makeDirectoryAsync(modelDir(), { intermediates: true }).catch(
    () => {}
  );

  const resumeData = await getModelResumeData();
  const onProgress = (p: FileSystem.DownloadProgressData) => {
    if (p.totalBytesExpectedToWrite > 0) {
      emit({
        state: 'downloading',
        progress: p.totalBytesWritten / p.totalBytesExpectedToWrite,
      });
    }
  };

  activeDownload = FileSystem.createDownloadResumable(
    MODEL_URL,
    tmpUri(),
    {},
    onProgress,
    resumeData ?? undefined
  );

  try {
    const result = await activeDownload.downloadAsync();
    activeDownload = null;
    if (!result) throw new Error('Download was cancelled.');
    await setModelResumeData(null);
    // Move the completed temp file into place.
    await FileSystem.deleteAsync(modelUri(), { idempotent: true });
    await FileSystem.moveAsync({ from: tmpUri(), to: modelUri() });
    const info = await FileSystem.getInfoAsync(modelUri());
    emit({ state: 'downloaded', sizeBytes: info.exists ? info.size ?? 0 : 0 });
  } catch (e) {
    activeDownload = null;
    // Keep whatever partial state exists so a later attempt can resume.
    await refreshModelStatus();
    if (status.state === 'not_downloaded') emit({ state: 'paused', progress: 0 });
    throw e instanceof Error ? e : new Error('Download failed.');
  }
}

/** Pause/cancel the in-flight download. Partial data is kept for resume. */
export async function cancelDownload(): Promise<void> {
  if (!activeDownload) return;
  try {
    const pause = await activeDownload.pauseAsync();
    await setModelResumeData(JSON.stringify(pause));
  } catch {
    // pauseAsync throws on some platforms when already finished - ignore.
  }
  activeDownload = null;
  await refreshModelStatus();
}

/** Unload the engine (if loaded) and delete the model file from disk. */
export async function deleteModel(): Promise<void> {
  await unloadEngine();
  await activeDownload?.cancelAsync().catch(() => {});
  activeDownload = null;
  await setModelResumeData(null);
  await FileSystem.deleteAsync(modelUri(), { idempotent: true });
  await FileSystem.deleteAsync(tmpUri(), { idempotent: true });
  emit({ state: 'not_downloaded' });
}

function friendlyLocalError(e: unknown): Error {
  if (isMemoryError(e)) {
    return new Error(
      'Not enough free memory to load this model. Close other apps and try again (a device with 6-8 GB RAM is recommended).'
    );
  }
  if (e instanceof LiteRTLMError) {
    switch (e.code) {
      case 'MEMORY_ESTIMATE_EXCEEDED':
        return new Error(
          'The model likely will not fit in this device\'s memory. Try closing other apps.'
        );
      case 'MODEL_NOT_FOUND':
        return new Error(
          'Model file not found - re-download it from Chat settings.'
        );
      case 'MODEL_NOT_LOADED':
        return new Error('The model is not loaded yet - try again.');
      case 'ENGINE_INIT_FAILED':
        return new Error(
          'This device does not support the local AI engine (an ARM device is required).'
        );
      case 'DOWNLOAD_FAILED':
        return new Error('Model download failed - check your connection.');
    }
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/out of memory|oom|allocat/i.test(msg)) {
    return new Error('The device ran out of memory. Close other apps and retry.');
  }
  if (/unsupported|abi|x86/i.test(msg)) {
    return new Error(
      'Local AI is unsupported on this device (ARM hardware required).'
    );
  }
  return new Error(msg || 'Local generation failed.');
}

/** Lazily create + load the engine. Reloads if the backend changed. */
async function ensureEngine(
  backend: LocalBackend,
  systemPrompt?: string
): Promise<LiteRTLMInstance> {
  if (engine && engineBackend === backend) return engine;
  if (engineLoading) return engineLoading;

  if (engine) {
    // Backend changed: unload and reload.
    await engine.unload().catch(() => {});
    engine = null;
    engineBackend = null;
    conversations.clear();
    needsTranscript.clear();
  }

  emit({ state: 'loading' });
  engineLoading = (async () => {
    const instance = createLLM();
    await instance.loadModel(modelUri(), {
      // 'auto' tries GPU first; the native layer falls back to CPU.
      backend: backend === 'auto' ? 'gpu' : backend,
      systemPrompt,
      maxContextTokens: LOCAL_CONTEXT_TOKENS,
    });
    engine = instance;
    engineBackend = backend;
    emit({ state: 'loaded' });
    return instance;
  })();

  try {
    return await engineLoading;
  } catch (e) {
    engine = null;
    engineBackend = null;
    await refreshModelStatus();
    throw friendlyLocalError(e);
  } finally {
    engineLoading = null;
  }
}

/** Load the downloaded model into memory so the chat can use it. */
export async function loadLocalModel(
  backend: LocalBackend,
  systemPrompt?: string
): Promise<void> {
  await ensureEngine(backend, systemPrompt);
}

export async function unloadEngine(): Promise<void> {
  engineLoading = null;
  if (engine) {
    const e = engine;
    engine = null;
    engineBackend = null;
    conversations.clear();
    needsTranscript.clear();
    await e.unload().catch(() => {});
  }
  await refreshModelStatus();
}

/** Drop a chat's in-memory conversation (e.g. after the chat was deleted). */
export async function releaseLocalConversation(chatId: string): Promise<void> {
  const handle = conversations.get(chatId);
  conversations.delete(chatId);
  needsTranscript.delete(chatId);
  await handle?.release().catch(() => {});
}

function transcriptPrefix(history: { role: string; content: string }[]): string {
  // Keep the most recent turns that fit the budget, oldest first.
  const lines: string[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const who = m.role === 'assistant' ? 'Assistant' : 'User';
    const line = `${who}: ${m.content}`;
    if (used + line.length > TRANSCRIPT_BUDGET) break;
    lines.unshift(line);
    used += line.length;
  }
  if (lines.length === 0) return '';
  return (
    'Here is our conversation so far, for context:\n\n' +
    lines.join('\n\n') +
    '\n\nNow continue the conversation.\n\nUser: '
  );
}

export function createLocalProvider(opts: {
  backend: LocalBackend;
  isModelDownloaded: () => boolean;
}): ChatProvider {
  return {
    id: 'local',
    label: 'Local (Gemma 4 E2B)',
    requiresNetwork: false,

    async generate(history, { systemPrompt, signal, onToken, conversationId, onContext }) {
      const lastMsg = history[history.length - 1];
      if (lastMsg?.imageUri || lastMsg?.audioUri) {
        throw new Error(
          'Voice and image messages need Cloud AI (Gemini). Switch the provider in Chat settings.'
        );
      }
      if (!opts.isModelDownloaded()) {
        throw new Error(
          'Local model is not downloaded. Open Chat settings > Local AI to download it (~2.6 GB).'
        );
      }

      const llm = await ensureEngine(opts.backend, systemPrompt);

      let handle = conversations.get(conversationId);
      if (!handle) {
        handle = llm.createConversation({ systemPrompt });
        conversations.set(conversationId, handle);
        if (history.length > 1) needsTranscript.add(conversationId);
      }

      const last = history[history.length - 1];
      let prompt = last?.content ?? '';
      if (needsTranscript.has(conversationId)) {
        needsTranscript.delete(conversationId);
        prompt = transcriptPrefix(history.slice(0, -1)) + prompt;
      }

      let aborted = false;
      const onAbort = () => {
        aborted = true;
      };
      signal?.addEventListener('abort', onAbort);

      let full = '';
      try {
        // No cancel API in the library: once aborted we stop forwarding
        // tokens and resolve with what we have; generation continues in
        // the background briefly.
        await handle.execute(
          [{ type: 'text', text: prompt }],
          (token) => {
            if (aborted) return;
            full += token;
            onToken(token);
          }
        );
      } catch (e) {
        throw friendlyLocalError(e);
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
      const forecast = llm.getMemoryForecast();
      if (forecast && forecast.contextTokensUsed >= 0) {
        onContext?.({
          usedTokens: forecast.contextTokensUsed,
          maxTokens: forecast.maxContextTokens,
        });
      }
      return full;
    },
  };
}
