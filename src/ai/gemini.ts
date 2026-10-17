// Cloud provider: Gemini via raw REST (no SDK).
// Uses expo/fetch because the stock React Native fetch does not stream.
import { fetch } from 'expo/fetch';
import { readAttachmentBase64 } from '@/attachments/files';
import { MAX_INLINE_REQUEST_CHARS } from '@/attachments/limits';
import type { ChatMessage, ChatProvider } from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiProviderOptions {
  apiKey: string;
  model: string;
}

interface ApiErrorDetails {
  '@type'?: string;
  retryDelay?: string;
  violations?: { quotaId?: string; quotaDimensions?: { model?: string } }[];
}

class HttpError extends Error {
  constructor(public status: number, public apiMessage?: string, public details: ApiErrorDetails[] = [], public retryAfterMs?: number) {
    super(apiMessage ?? `HTTP ${status}`);
  }
}

function friendlyError(error: unknown, model?: string): Error {
  if (error instanceof HttpError) {
    if (error.status === 429) return new Error('Available cloud models are limited. Please try again later.');
    if ([500, 502, 503, 504].includes(error.status)) return new Error('Cloud AI is busy. Please try again shortly.');
    if (error.status === 404) return new Error(`Model ${model} is unavailable. Choose Auto in Detector settings.`);
    if (error.status === 401 || error.status === 403) return new Error('Check your Gemini API key and access in Detector settings.');
    return new Error(error.apiMessage ?? `Request failed (HTTP ${error.status}).`);
  }
  return error instanceof Error && error.name === 'AbortError' ? error : new Error('Network request failed. Check your connection.');
}

async function toHttpError(res: Response): Promise<HttpError> {
  let body;
  try { body = await res.json(); } catch { /* Non-JSON server error. */ }
  const retry = res.headers.get('retry-after');
  const retryAfterMs = retry ? (/^\d+(?:\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : undefined;
  return new HttpError(res.status, body?.error?.message, body?.error?.details, retryAfterMs);
}

async function throwForBadResponse(res: Response): Promise<void> {
  if (!res.ok) throw await toHttpError(res);
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

/** Model families that can't serve text chat (TTS, image, live, etc.). */
const NON_CHAT_MODEL = /(tts|image|imagen|veo|audio|live|embedding|aqa|robotics|computer-use|native)/i;

/** List Gemini models that support generateContent (follows pageToken). */
// Context window (input token limit) per model name, filled as models are listed.
const inputLimits = new Map<string, number>();

/** Context window of a model, from the list cache or a one-off lookup. */
async function getInputLimit(apiKey: string, model: string): Promise<number | undefined> {
  if (inputLimits.has(model)) return inputLimits.get(model);
  try {
    const res = await fetch(`${API_BASE}/models/${model}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (!res.ok) return undefined;
    const limit = Number((await res.json()).inputTokenLimit) || undefined;
    if (limit) inputLimits.set(model, limit);
    return limit;
  } catch {
    return undefined;
  }
}

export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const models: string[] = [];
  let pageToken: string | undefined;
  do {
    const url =
      `${API_BASE}/models` + (pageToken ? `?pageToken=${pageToken}` : '');
    const res = await fetch(url, { headers: { 'x-goog-api-key': apiKey } });
    await throwForBadResponse(res);
    const body = await res.json();
    for (const m of body.models ?? []) {
      if ((m.supportedGenerationMethods ?? []).includes('generateContent')) {
        const name = String(m.name).replace(/^models\//, '');
        if (NON_CHAT_MODEL.test(name)) continue;
        models.push(name);
        if (m.inputTokenLimit) inputLimits.set(name, Number(m.inputTokenLimit));
      }
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return models.sort();
}

/** Setting value meaning "pick the best model this key can use". */
export const AUTO_MODEL = 'auto';
const FALLBACK_MODEL = 'gemini-flash-latest';

/** Version number in a model name, e.g. "gemini-2.5-flash" -> 2.5. */
const versionOf = (name: string) =>
  parseFloat(/^gemini-(\d+(?:\.\d+)?)/.exec(name)?.[1] ?? '0');

/**
 * Choose the best default from the catalogue: the
 * newest stable Flash, Flash-Lite, then any stable Gemini or current alias.
 * Concrete stable versions avoid retrying aliases of the same exhausted model.
 */
export function pickBestModel(models: string[]): string | null {
  const stable = models
    .filter((m) => /^gemini-\d/.test(m))
    .filter((m) => !/preview|exp|image|tts|audio|live|embedding|thinking/.test(m))
    .sort((a, b) => versionOf(b) - versionOf(a));
  return (
    stable.find((m) => /-flash(-\d{3})?$/.test(m)) ??
    stable.find((m) => /-flash-lite(-\d{3})?$/.test(m)) ??
    (models.includes(FALLBACK_MODEL) ? FALLBACK_MODEL : null) ??
    stable[0] ??
    models[0] ??
    null
  );
}

// Refresh availability periodically. Quota observations are session-only and
// account scoped; listing a model does not prove it has remaining quota.
const CACHE_MS = 10 * 60 * 1000;
const modelListCache = new Map<string, { models: string[]; expires: number }>();
const modelListPending = new Map<string, Promise<string[] | null>>();
const cooldowns = new Map<string, Map<string, number>>();

async function modelListFor(apiKey: string): Promise<string[] | null> {
  const cached = modelListCache.get(apiKey);
  if (cached && cached.expires > Date.now()) return cached.models;
  const pending = modelListPending.get(apiKey);
  if (pending) return pending;
  const request = listGeminiModels(apiKey)
    .then((models) => { modelListCache.set(apiKey, { models, expires: Date.now() + CACHE_MS }); return models; })
    .catch(() => null)
    .finally(() => modelListPending.delete(apiKey));
  modelListPending.set(apiKey, request);
  return request;
}

/** Flash-Lite / Flash / Pro tiers from the models a key can use. */
function modelTiers(models: string[]): {
  lite: string;
  flash: string;
  pro: string;
} {
  const stable = models
    .filter((m) => /^gemini-\d/.test(m))
    .filter(
      (m) => !/preview|exp|image|tts|audio|live|embedding|thinking/.test(m)
    )
    .sort((a, b) => versionOf(b) - versionOf(a));
  const flash = pickBestModel(models) ?? FALLBACK_MODEL;
  return {
    lite: stable.find((m) => /-flash-lite(-\d{3})?$/.test(m)) ?? flash,
    flash,
    pro: stable.find((m) => /-pro(-\d{3})?$/.test(m)) ?? flash,
  };
}

/** Requests that deserve the Pro tier. */
const COMPLEX_REQUEST =
  /\b(prove|step[- ]by[- ]step|analy[sz]e|debug|refactor|algorithm|derive|essay|in[- ]depth|detailed|compare|explain why)\b/i;

/**
 * Route a message to a model tier for "Auto": Flash-Lite for quick
 * questions, Flash for attachments and normal chat, Pro for complex asks.
 */
export function routeModel(models: string[], history: ChatMessage[]): string {
  const tiers = modelTiers(models);
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) return tiers.flash;
  if (lastUser.imageUri || lastUser.audioUri || lastUser.videoUri) return tiers.flash;
  const content = lastUser.content;
  const totalChars = history.reduce((n, m) => n + m.content.length, 0);
  if (
    content.length > 1500 ||
    content.includes('```') ||
    totalChars > 20000 ||
    COMPLEX_REQUEST.test(content)
  ) {
    return tiers.pro;
  }
  if (content.trim().length < 60) return tiers.lite;
  return tiers.flash;
}

/** Only retry errors another model can resolve. Bad keys and bad payloads stop. */
function canFallback(error: HttpError): boolean {
  return [429, 404, 500, 502, 503, 504].includes(error.status) ||
    error.status === 400 && /context (?:window|length)|input.*token.*limit|does not support.*(?:image|audio|system instruction)/i.test(error.apiMessage ?? '');
}

function modelBucket(model: string): string {
  return model.replace(/^models\//, '').replace(/-\d{3}$/, '');
}

function cooldownUntil(apiKey: string, model: string): number {
  const health = cooldowns.get(apiKey);
  return Math.max(health?.get(modelBucket(model)) ?? 0, health?.get('*') ?? 0);
}

function markUnavailable(apiKey: string, model: string, error: HttpError) {
  const health = cooldowns.get(apiKey) ?? new Map<string, number>();
  cooldowns.set(apiKey, health);
  const daily = /PerDay|per.day|daily|limit:\s*0\b/i.test(`${error.apiMessage ?? ''} ${JSON.stringify(error.details)}`);
  let delay = error.status === 429 ? daily ? 60 * 60 * 1000 : 60 * 1000 : error.status === 404 ? CACHE_MS : 30 * 1000;
  for (const detail of error.details) {
    if (detail.retryDelay) {
      const seconds = Number(detail.retryDelay.replace(/s$/, ''));
      if (Number.isFinite(seconds)) delay = Math.max(delay, seconds * 1000);
    }
  }
  if (Number.isFinite(error.retryAfterMs)) delay = Math.max(delay, error.retryAfterMs!);
  const until = Date.now() + delay;
  health.set(modelBucket(model), until);
  for (const detail of error.details) {
    for (const violation of detail.violations ?? []) {
      if (violation.quotaDimensions?.model) health.set(modelBucket(violation.quotaDimensions.model), until);
    }
  }
  // Project-wide spend limits cannot be resolved by choosing another model.
  if (error.status === 429 && /spend[- ]based|spend.*limit/i.test(error.apiMessage ?? '')) health.set('*', until);
  if (error.status === 404) modelListCache.delete(apiKey);
}

async function candidateModels(apiKey: string, chosen: string, history: ChatMessage[]): Promise<string[]> {
  const catalog = await modelListFor(apiKey);
  const available = catalog ?? [];
  const media = history.some((message) => message.imageUri || message.audioUri || message.videoUri);
  const tiers = modelTiers(available);
  const ranked = [...available].sort((a, b) => {
    const penalty = (name: string) => (/preview|exp/.test(name) ? 10 : 0) + (/^gemma-/.test(name) ? 5 : 0);
    return penalty(a) - penalty(b) || versionOf(b) - versionOf(a) || a.localeCompare(b);
  });
  const proposed = [chosen === AUTO_MODEL ? routeModel(available, history) : chosen, tiers.flash, tiers.lite, tiers.pro, ...ranked];
  if (!catalog) proposed.push(FALLBACK_MODEL);
  const seen = new Set<string>();
  return proposed.filter((candidate, index) => {
    if (catalog && !available.includes(candidate) && !(index === 0 && chosen !== AUTO_MODEL)) return false;
    if (NON_CHAT_MODEL.test(candidate) || media && !/^gemini-/.test(candidate)) return false;
    // The generic latest aliases are redundant when that concrete family exists.
    if (candidate !== chosen && /-latest$/.test(candidate)) {
      const family = candidate.replace(/-latest$/, '').replace('gemini-', '');
      if (available.some((name) => /^gemini-\d/.test(name) && name.endsWith(`-${family}`) && !/preview|exp/.test(name))) return false;
    }
    const bucket = modelBucket(candidate);
    if (seen.has(bucket)) return false;
    seen.add(bucket);
    return true;
  });
}

export function createGeminiProvider({ apiKey, model }: GeminiProviderOptions): ChatProvider {
  return {
    id: 'cloud',
    label: `Gemini (${model === AUTO_MODEL ? 'auto' : model})`,
    requiresNetwork: true,

    async generate(history, { systemPrompt, signal, onToken, onContext, onModel }) {
      checkAbort(signal);
      const contents: { role: string; parts: Record<string, unknown>[] }[] = [];
      let remaining = MAX_INLINE_REQUEST_CHARS;
      // Read sequentially with a shared budget; Promise.all can allocate every
      // historical image/video at once before any request size check runs.
      for (const message of history) {
        checkAbort(signal);
        if (message.content) {
          // Reserve enough room for JSON escaping, including control characters.
          remaining -= message.content.length * 6;
          if (remaining < 0) throw new Error('This chat is too large to send. Start a new chat.');
        }
        const parts: Record<string, unknown>[] = [];
        const mediaParts: [string | undefined, 'image' | 'audio' | 'video'][] = [
          [message.imageUri, 'image'],
          [message.audioUri, 'audio'],
          [message.videoUri, 'video'],
        ];
        for (const [uri, kind] of mediaParts) {
          if (uri) {
            checkAbort(signal);
            const { mimeType, data } = await readAttachmentBase64(uri, kind, Math.floor(remaining / 4) * 3);
            checkAbort(signal);
            remaining -= data.length;
            if (remaining < 0) throw new Error('These attachments are too large. Start a new chat with fewer attachments.');
            parts.push({ inlineData: { mimeType, data } });
          }
        }
        if (message.content) parts.push({ text: message.content });
        contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts });
      }
      const candidates = await candidateModels(apiKey, model, history);
      checkAbort(signal);
      let failure: unknown;
      let failedModel: string | undefined;
      let skipped = false;

      for (const candidate of candidates) {
        checkAbort(signal);
        if (cooldownUntil(apiKey, candidate) > Date.now()) { skipped = true; continue; }
        // Build per candidate: cloud Gemma rejects systemInstruction.
        const candidateContents = contents.map((content) => ({ ...content, parts: [...content.parts] }));
        const body: Record<string, unknown> = { contents: candidateContents };
        if (systemPrompt) {
          if (/^gemma-/.test(candidate)) candidateContents.find((content) => content.role === 'user')?.parts.unshift({ text: `${systemPrompt}\n\n` });
          else body.systemInstruction = { parts: [{ text: systemPrompt }] };
        }
        let full = '';
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        try {
          const response = await fetch(`${API_BASE}/models/${candidate}:streamGenerateContent?alt=sse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(body), signal,
          });
          if (!response.ok) throw await toHttpError(response);
          if (!response.body) throw new Error('Empty response stream.');
          reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let usedTokens: number | undefined;
          let announced = false;
          const handleLine = (line: string) => {
            if (!line.startsWith('data:')) return;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') return;
            let json;
            try { json = JSON.parse(payload); } catch { return; }
            if (json?.error) throw new HttpError(Number(json.error.code) || 500, json.error.message, json.error.details);
            if (typeof json?.usageMetadata?.totalTokenCount === 'number') usedTokens = json.usageMetadata.totalTokenCount;
            for (const part of json?.candidates?.[0]?.content?.parts ?? []) {
              if (typeof part.text === 'string' && part.text && !part.thought) {
                if (!announced) { onModel?.(candidate); announced = true; }
                full += part.text;
                onToken(part.text);
              }
            }
          };
          while (true) {
            checkAbort(signal);
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newline: number;
            while ((newline = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, newline);
              buffer = buffer.slice(newline + 1);
              handleLine(line);
            }
          }
          buffer += decoder.decode();
          handleLine(buffer);
          checkAbort(signal);
          cooldowns.get(apiKey)?.delete(modelBucket(candidate));
          if (usedTokens !== undefined) onContext?.({ usedTokens, maxTokens: inputLimits.get(candidate) });
          if (!inputLimits.has(candidate)) void getInputLimit(apiKey, candidate);
          return full;
        } catch (error) {
          checkAbort(signal);
          failure = error;
          failedModel = candidate;
          if (error instanceof HttpError && canFallback(error)) {
            markUnavailable(apiKey, candidate, error);
            // Switching after tokens were shown would merge two unrelated answers.
            if (!full) continue;
          }
          throw friendlyError(error, candidate);
        } finally {
          if (reader) {
            try { await reader.cancel(); } catch { /* Closed or interrupted stream. */ }
            reader.releaseLock();
          }
        }
      }
      if (failure) throw friendlyError(failure, failedModel);
      if (skipped) {
        const soonest = Math.min(...candidates.map((candidate) => cooldownUntil(apiKey, candidate)));
        const minutes = Math.max(1, Math.ceil((soonest - Date.now()) / 60000));
        throw new Error(`Cloud models are limited. Retry in about ${minutes} min.`);
      }
      throw new Error('No compatible cloud model is available for this message.');
    },
  };
}
