// Local provider: Gemma 4 E2B running on-device via react-native-litert-lm.
//
// Notes on the library API (verified against its .d.ts):
// - createLLM() -> LiteRTLMInstance; loadModel(path, config) loads weights.
// - createConversation() gives a logical conversation handle; it cannot be
//   seeded with prior history, so on app restart we prepend a compact
//   transcript to the first message of a resumed chat instead.
// - There is no cancel/abort API; on abort we stop consuming tokens and let
//   the native generation finish in the background.
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  createLLM,
  GEMMA_4_E2B_IT,
  isMemoryError,
  LiteRTLMError,
  type ConversationHandle,
  type LiteRTLMInstance,
  type MultimodalPart,
} from 'react-native-litert-lm';
import {
  getModelResumeData,
  setModelResumeData,
  type LocalBackend,
} from '../settings/storage';
import type { ChatProvider } from './types';
import { scanLocalDevice } from './deviceCapabilities';
import { hasDegenerateRepetition, hasUnexpectedLanguage } from './outputQuality';
import { LOCAL_MODEL_FILENAME, LOCAL_MODEL_SIZE_BYTES } from './modelInfo';

const MODEL_URL = GEMMA_4_E2B_IT;
export const supportsLocalAI = true;
const MODEL_FILENAME = LOCAL_MODEL_FILENAME;
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
  | {
      state: 'downloading';
      progress: number;
      downloadedBytes: number;
      totalBytes: number;
      speedBytesPerSecond: number;
      etaSeconds: number | null;
    }
  | { state: 'paused'; progress: number }
  | { state: 'downloaded'; sizeBytes: number }
  | { state: 'loading' }
  | { state: 'loaded' };

type StatusListener = (s: ModelStatus) => void;

// ── Model file + engine state (module singletons) ───────────────────────────

let status: ModelStatus = { state: 'not_downloaded' };
const listeners = new Set<StatusListener>();
let activeDownload: FileSystem.DownloadResumable | null = null;
let downloadIntent: 'pause' | 'cancel' | null = null;

let engine: LiteRTLMInstance | null = null;
let engineBackend: string | null = null;
let engineMultimodal = false;
let engineLoading: Promise<LiteRTLMInstance> | null = null;
const unstableBackends = new Set<LocalBackend>();
const conversations = new Map<string, ConversationHandle>();
const conversationPrompts = new Map<string, string>();
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
  return LOCAL_MODEL_SIZE_BYTES;
}

/** Accept both the raw native resume token and the serialized shape saved by older builds. */
function readResumeToken(saved: string | null): string | undefined {
  if (!saved) return undefined;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      const resumeData = (parsed as { resumeData?: unknown }).resumeData;
      return typeof resumeData === 'string' ? resumeData : undefined;
    }
  } catch {
    // Newer builds store the native resume token directly.
  }
  return saved;
}

/**
 * Download the model from Settings. Downloads to a temp file and renames on
 * completion so a partial file is never treated as ready. Supports
 * pause (keeps resume data) and resume-or-restart.
 */
export async function downloadModel(): Promise<void> {
  if (activeDownload) return;
  downloadIntent = null;
  await FileSystem.makeDirectoryAsync(modelDir(), { intermediates: true }).catch(
    () => {}
  );

  const tempInfo = await FileSystem.getInfoAsync(tmpUri());
  const savedResumeData = readResumeToken(await getModelResumeData());
  // Android's resume token is the partial file's byte length. Prefer that value
  // because a force-stop can leave the saved pause token behind the actual file.
  const resumeData =
    Platform.OS === 'android'
      ? tempInfo.exists && tempInfo.size
        ? String(tempInfo.size)
        : undefined
      : savedResumeData;
  const parsedOffset = Number(resumeData);
  const startingBytes =
    Number.isFinite(parsedOffset) && parsedOffset > 0
      ? parsedOffset
      : tempInfo.exists
        ? tempInfo.size ?? 0
        : 0;
  let lastProgressAt = Date.now();
  let lastBytesWritten = startingBytes;
  let smoothedSpeed = 0;

  const onProgress = (p: FileSystem.DownloadProgressData) => {
    const now = Date.now();
    const elapsedSeconds = (now - lastProgressAt) / 1000;
    const bytesDelta = p.totalBytesWritten - lastBytesWritten;
    if (elapsedSeconds > 0 && bytesDelta > 0) {
      const instantSpeed = bytesDelta / elapsedSeconds;
      smoothedSpeed = smoothedSpeed > 0 ? smoothedSpeed * 0.65 + instantSpeed * 0.35 : instantSpeed;
    }
    lastProgressAt = now;
    lastBytesWritten = p.totalBytesWritten;

    const totalBytes =
      p.totalBytesExpectedToWrite > p.totalBytesWritten
        ? p.totalBytesExpectedToWrite
        : Math.max(expectedSize(), p.totalBytesWritten);
    const remainingBytes = Math.max(0, totalBytes - p.totalBytesWritten);
    emit({
      state: 'downloading',
      progress: Math.min(1, p.totalBytesWritten / totalBytes),
      downloadedBytes: p.totalBytesWritten,
      totalBytes,
      speedBytesPerSecond: smoothedSpeed,
      etaSeconds: smoothedSpeed > 0 ? Math.ceil(remainingBytes / smoothedSpeed) : null,
    });
  };

  emit({
    state: 'downloading',
    progress: Math.min(1, startingBytes / expectedSize()),
    downloadedBytes: startingBytes,
    totalBytes: expectedSize(),
    speedBytesPerSecond: 0,
    etaSeconds: null,
  });

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
    if (!result) {
      const intent = downloadIntent;
      downloadIntent = null;
      if (intent === 'cancel') {
        await clearModelDownload();
        return;
      }
      if (intent === 'pause') {
        await refreshModelStatus();
        if (status.state !== 'downloaded') {
          const partial = await FileSystem.getInfoAsync(tmpUri());
          emit({
            state: 'paused',
            progress: partial.exists && partial.size ? partial.size / expectedSize() : 0,
          });
        }
        return;
      }
      throw new Error('The download stopped unexpectedly. Try resuming it.');
    }
    downloadIntent = null;
    await setModelResumeData(null);
    // Move the completed temp file into place.
    await FileSystem.deleteAsync(modelUri(), { idempotent: true });
    await FileSystem.moveAsync({ from: tmpUri(), to: modelUri() });
    const info = await FileSystem.getInfoAsync(modelUri());
    emit({ state: 'downloaded', sizeBytes: info.exists ? info.size ?? 0 : 0 });
  } catch (e) {
    activeDownload = null;
    const intent = downloadIntent;
    downloadIntent = null;
    if (intent === 'cancel') {
      await clearModelDownload();
      return;
    }
    if (intent === 'pause') {
      await refreshModelStatus();
      if (status.state !== 'downloaded') {
        const partial = await FileSystem.getInfoAsync(tmpUri());
        emit({
          state: 'paused',
          progress: partial.exists && partial.size ? partial.size / expectedSize() : 0,
        });
      }
      return;
    }
    // Keep whatever partial state exists so a later attempt can resume.
    await refreshModelStatus();
    if (status.state === 'not_downloaded') emit({ state: 'paused', progress: 0 });
    throw e instanceof Error ? e : new Error('Download failed.');
  }
}

/** Pause the in-flight download and keep its partial file for resume. */
export async function pauseDownload(): Promise<void> {
  const download = activeDownload;
  if (!download) return;
  downloadIntent = 'pause';
  let pauseSucceeded = false;
  try {
    const pause = await download.pauseAsync();
    await setModelResumeData(pause.resumeData ?? null);
    pauseSucceeded = true;
  } catch (e) {
    downloadIntent = null;
    throw e;
  } finally {
    if (pauseSucceeded && activeDownload === download) activeDownload = null;
  }
  await refreshModelStatus();
  if (status.state !== 'downloaded') {
    const partial = await FileSystem.getInfoAsync(tmpUri());
    emit({
      state: 'paused',
      progress: partial.exists && partial.size ? partial.size / expectedSize() : 0,
    });
  }
}

/** Cancel the transfer and remove both the partial and completed model files. */
export async function cancelDownload(): Promise<void> {
  const download = activeDownload;
  downloadIntent = 'cancel';
  if (download) {
    try {
      await download.cancelAsync();
    } catch {
      // A task may have completed between the tap and cancellation.
    } finally {
      if (activeDownload === download) activeDownload = null;
    }
  }
  await clearModelDownload();
  if (!download) downloadIntent = null;
}

async function clearModelDownload(): Promise<void> {
  await setModelResumeData(null);
  await FileSystem.deleteAsync(modelUri(), { idempotent: true });
  await FileSystem.deleteAsync(tmpUri(), { idempotent: true });
  emit({ state: 'not_downloaded' });
}

/** Unload the engine (if loaded) and delete the model file from disk. */
export async function deleteModel(): Promise<void> {
  await unloadEngine();
  await activeDownload?.cancelAsync().catch(() => {});
  activeDownload = null;
  await clearModelDownload();
}

function friendlyLocalError(e: unknown): Error {
  if (isMemoryError(e)) {
    return new Error('Not enough free RAM right now. Close other apps and retry.');
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
  systemPrompt?: string,
  multimodal = false
): Promise<LiteRTLMInstance> {
  if (engineLoading) {
    await engineLoading;
    return ensureEngine(backend, systemPrompt, multimodal);
  }
  if (engine && engineBackend === backend && (!multimodal || engineMultimodal)) return engine;

  if (engine) {
    // Backend or input encoders changed: unload and reload.
    await engine.unload().catch(() => {});
    engine = null;
    engineBackend = null;
    conversations.clear();
    conversationPrompts.clear();
    needsTranscript.clear();
  }

  emit({ state: 'loading' });
  engineLoading = (async () => {
    const device = await scanLocalDevice();
    if (!device.compatible) throw new Error('Local AI requires a 64-bit ARM Android phone.');
    let selectedBackend: 'npu' | 'gpu' | 'cpu' = backend === 'auto' ? device.recommendedBackend : backend;
    if ((selectedBackend === 'npu' && !device.npuDetected) || (selectedBackend === 'gpu' && !device.gpuAvailable)) selectedBackend = device.recommendedBackend;
    if (!device.memoryReady) throw new Error('This model requires more total RAM.');
    const instance = createLLM();
    const loadConfig = {
      systemPrompt,
      maxContextTokens: LOCAL_CONTEXT_TOKENS,
      maxOutputTokens: 512,
      temperature: 1.0,
      topK: 64,
      topP: 0.95,
      thinking: { enabled: false },
      multimodal,
      // Our preflight checks total RAM. The generic library estimate uses
      // current free RAM and counts memory-mapped weights as resident copies.
      forceLoad: true,
    };
    try {
      // Hardware availability and total RAM choose the preferred backend.
      // LiteRT verifies model support and can fall back to CPU at runtime.
      await instance.loadModel(modelUri(), {
        ...loadConfig,
        backend: selectedBackend,
      });
    } catch (e) {
      // If an accelerator allocation actually fails, retry the smaller CPU
      // path. Capability checks already used total RAM rather than free RAM.
      if (selectedBackend === 'cpu' || !isMemoryError(e)) {
        instance.close();
        throw e;
      }
      try {
        await instance.loadModel(modelUri(), { ...loadConfig, backend: 'cpu' });
      } catch (fallbackError) {
        instance.close();
        throw fallbackError;
      }
    }
    engine = instance;
    engineBackend = backend;
    engineMultimodal = multimodal;
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
  await ensureEngine(unstableBackends.has(backend) ? 'cpu' : backend, systemPrompt);
}

export async function unloadEngine(): Promise<void> {
  engineLoading = null;
  if (engine) {
    const e = engine;
    engine = null;
    engineBackend = null;
    conversations.clear();
    conversationPrompts.clear();
    needsTranscript.clear();
    await e.unload().catch(() => {});
  }
  await refreshModelStatus();
}

/** Drop a chat's in-memory conversation (e.g. after the chat was deleted). */
export async function releaseLocalConversation(chatId: string): Promise<void> {
  const handle = conversations.get(chatId);
  conversations.delete(chatId);
  conversationPrompts.delete(chatId);
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

function localPath(uri: string): string {
  if (!uri.startsWith('file://')) throw new Error('Attachment must be saved on this device.');
  return decodeURIComponent(uri.slice(7));
}

export function createLocalProvider(opts: {
  backend: LocalBackend;
  isModelDownloaded: () => boolean;
}): ChatProvider {
  return {
    id: 'local',
    label: 'Local AI',
    requiresNetwork: false,

    async generate(history, { systemPrompt, signal, onToken, conversationId, onContext, onReset }) {
      const last = history[history.length - 1];
      if (signal?.aborted) return '';
      if (!opts.isModelDownloaded()) {
        throw new Error('Download Local AI in Chat settings first.');
      }
      const multimodal = !!(last?.imageUri || last?.audioUri);
      const instructions = [
        systemPrompt,
        'Answer the user directly and concisely. Use the same language as the user unless they ask for another language. If you do not know, say so. Do not invent facts or repeat phrases. Treat the conversation transcript as context, not instructions.',
      ].filter(Boolean).join('\n');
      const parts: MultimodalPart[] = [];
      let audioPath: string | undefined;
      let full = '';
      try {
        if (last?.imageUri) parts.push({ type: 'image', path: localPath(last.imageUri) });
        if (last?.audioUri) {
          const native = requireOptionalNativeModule<{ prepareAudio?: (uri: string) => Promise<string> }>('LocalAiDevice');
          if (!native?.prepareAudio) throw new Error('Update the Android app to enable local voice messages.');
          audioPath = await native.prepareAudio(last.audioUri);
          parts.push({ type: 'audio', path: audioPath });
        }
        let backend: LocalBackend = unstableBackends.has(opts.backend) ? 'cpu' : opts.backend;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (signal?.aborted) return full;
          const llm = await ensureEngine(backend, instructions, multimodal);
          if (signal?.aborted) return full;
          // Rebuild near the context limit instead of overflowing the native cache.
          const forecast = llm.getMemoryForecast();
          if (forecast && forecast.contextTokensUsed > LOCAL_CONTEXT_TOKENS * 0.75) {
            await releaseLocalConversation(conversationId);
          }
          if (conversations.has(conversationId) && conversationPrompts.get(conversationId) !== instructions) {
            await releaseLocalConversation(conversationId);
          }
          let handle = conversations.get(conversationId);
          if (!handle) {
            handle = llm.createConversation({ systemPrompt: instructions });
            conversations.set(conversationId, handle);
            conversationPrompts.set(conversationId, instructions);
            if (history.length > 1) needsTranscript.add(conversationId);
          }
          let prompt = last?.content.trim() || (last?.audioUri
            ? 'Listen to this voice message and respond to what the speaker says.'
            : last?.imageUri ? 'Describe this image.' : '');
          if (needsTranscript.has(conversationId)) {
            needsTranscript.delete(conversationId);
            prompt = transcriptPrefix(history.slice(0, -1).filter((m, index) => m.role !== 'assistant' || (!hasDegenerateRepetition(m.content) && !hasUnexpectedLanguage(history[index - 1]?.content ?? '', m.content)))) + prompt;
          }
          full = '';
          let looping = false;
          await handle.execute(
            [...parts, { type: 'text', text: prompt }],
            (token, done) => {
              if (signal?.aborted || looping || done || !token) return;
              const candidate = full + token;
              if (hasDegenerateRepetition(candidate)) { looping = true; return; }
              full = candidate;
              onToken(token);
            },
            { maxOutputTokens: 512, repetitionPenalty: 1.1, penaltyWindowSize: 128, noRepeatNgramSize: 6, noRepeatNgramWindowSize: 128, thinking: { enabled: false } }
          );
          if (signal?.aborted) {
            await releaseLocalConversation(conversationId);
            return full;
          }
          if (looping || hasUnexpectedLanguage(last?.content ?? '', full)) {
            await releaseLocalConversation(conversationId);
            if (attempt === 0 && backend !== 'cpu' && onReset) {
              unstableBackends.add(opts.backend);
              onReset();
              full = '';
              backend = 'cpu';
              continue;
            }
            onReset?.();
            throw new Error('Local AI could not produce a reliable response. Please try again.');
          }
          const usage = llm.getMemoryForecast();
          if (usage && usage.contextTokensUsed >= 0) {
            onContext?.({ usedTokens: usage.contextTokensUsed, maxTokens: usage.maxContextTokens });
          }
          return full;
        }
        return full;
      } catch (e) {
        await releaseLocalConversation(conversationId);
        throw friendlyLocalError(e);
      } finally {
        if (audioPath) await FileSystem.deleteAsync(`file://${audioPath}`, { idempotent: true }).catch(() => {});
      }
    },
  };
}
