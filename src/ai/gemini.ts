// Cloud provider: Gemini via raw REST (no SDK).
// Uses expo/fetch because the stock React Native fetch does not stream.
import { fetch } from 'expo/fetch';
import { readAttachmentBase64 } from '@/attachments/files';
import type { ChatMessage, ChatProvider } from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiProviderOptions {
  apiKey: string;
  model: string;
}

class HttpError extends Error {
  status: number;
  apiMessage?: string;
  constructor(status: number, apiMessage?: string) {
    super(`HTTP ${status}`);
    this.status = status;
    this.apiMessage = apiMessage;
  }
}

function friendlyError(e: unknown, model?: string): Error {
  if (e instanceof HttpError) {
    if (e.status === 429) {
      return new Error('Free-tier rate limit reached, wait a minute.');
    }
    if (e.status === 500 || e.status === 503) {
      return new Error(
        `Gemini had a server error with ${model}${e.apiMessage ? ` (${e.apiMessage})` : ''}. This model may not support chat - choose "Auto" or another model in Chat settings.`
      );
    }
    if (e.status === 404) {
      return new Error(
        `Model ${model} was not found for this API key - choose another model in Chat settings.`
      );
    }
    if (e.status === 400 || e.status === 401 || e.status === 403) {
      return new Error(
        e.apiMessage
          ? `Invalid API key or model (${e.apiMessage})`
          : 'Invalid API key or model.'
      );
    }
    return new Error(e.apiMessage ?? `Request failed (HTTP ${e.status}).`);
  }
  return new Error('Network request failed - are you offline?');
}

async function toHttpError(res: Response): Promise<HttpError> {
  let apiMessage: string | undefined;
  try {
    const body = await res.json();
    apiMessage = body?.error?.message;
  } catch {
    // Body wasn't JSON - fall through to status-only error.
  }
  return new HttpError(res.status, apiMessage);
}

async function throwForBadResponse(res: Response): Promise<void> {
  if (res.ok) return;
  throw await toHttpError(res);
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
 * Choose the best default from the models a key can use: the always-current
 * Flash alias, else the newest stable Flash, Flash-Lite, then any stable Gemini.
 * Flash is preferred because it has the most generous free-tier limits.
 */
export function pickBestModel(models: string[]): string | null {
  if (models.includes(FALLBACK_MODEL)) return FALLBACK_MODEL;
  const stable = models
    .filter((m) => /^gemini-\d/.test(m))
    .filter((m) => !/preview|exp|image|tts|audio|live|embedding|thinking/.test(m))
    .sort((a, b) => versionOf(b) - versionOf(a));
  return (
    stable.find((m) => /-flash(-\d{3})?$/.test(m)) ??
    stable.find((m) => /-flash-lite(-\d{3})?$/.test(m)) ??
    stable[0] ??
    models[0] ??
    null
  );
}

// Model list per API key, cached for this app session.
const modelListCache = new Map<string, string[]>();

async function modelListFor(apiKey: string): Promise<string[] | null> {
  const cached = modelListCache.get(apiKey);
  if (cached) return cached;
  try {
    const list = await listGeminiModels(apiKey);
    modelListCache.set(apiKey, list);
    return list;
  } catch {
    // Listing failed (offline, bad key...); the generate call reports why.
    return null;
  }
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
  if (lastUser.imageUri || lastUser.audioUri) return tiers.flash;
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

/** Candidate models to try in order when the user picked "Auto". */
async function autoCandidates(
  apiKey: string,
  history: ChatMessage[]
): Promise<string[]> {
  const models = (await modelListFor(apiKey)) ?? [];
  const routed = routeModel(models, history);
  const flash = modelTiers(models).flash;
  return [...new Set([routed, flash, FALLBACK_MODEL])];
}

/** Statuses that make "Auto" fall through to the next candidate model. */
const TRY_NEXT_MODEL = new Set([429, 404, 500, 503]);

export function createGeminiProvider({
  apiKey,
  model,
}: GeminiProviderOptions): ChatProvider {
  return {
    id: 'cloud',
    label: `Gemini (${model === AUTO_MODEL ? 'auto' : model})`,
    requiresNetwork: true,

    async generate(history, { systemPrompt, signal, onToken, onContext, onModel }) {
      const isAuto = model === AUTO_MODEL;
      const candidates = isAuto
        ? await autoCandidates(apiKey, history)
        : [model];

      const contents = await Promise.all(
        history.map(async (m) => {
          const parts: Record<string, unknown>[] = [];
          if (m.imageUri) {
            const { mimeType, data } = await readAttachmentBase64(m.imageUri);
            parts.push({ inlineData: { mimeType, data } });
          }
          if (m.audioUri) {
            const { mimeType, data } = await readAttachmentBase64(m.audioUri);
            parts.push({ inlineData: { mimeType, data } });
          }
          if (m.content) parts.push({ text: m.content });
          return { role: m.role === 'assistant' ? 'model' : 'user', parts };
        })
      );

      const body: Record<string, unknown> = { contents };
      if (systemPrompt) {
        if (candidates.every((c) => /^gemma-/.test(c))) {
          // gemma-* models reject systemInstruction - fold it into the
          // first user message instead.
          contents
            .find((c) => c.role === 'user')
            ?.parts.unshift({ text: `${systemPrompt}\n\n` });
        } else {
          body.systemInstruction = { parts: [{ text: systemPrompt }] };
        }
      }

      const post = (m: string) =>
        fetch(`${API_BASE}/models/${m}:streamGenerateContent?alt=sse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
          signal,
        });

      let res: Response | null = null;
      let fail: HttpError | null = null;
      let resolved = candidates[0];

      for (const candidate of candidates) {
        resolved = candidate;
        // An explicitly chosen model gets one 1 s retry on 500/503.
        for (let attempt = 0; ; attempt++) {
          try {
            res = await post(candidate);
          } catch (e) {
            throw friendlyError(e, candidate);
          }
          if (res.ok) {
            fail = null;
            break;
          }
          fail = await toHttpError(res);
          const transient = fail.status === 500 || fail.status === 503;
          if (!isAuto && transient && attempt === 0 && !signal?.aborted) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          break;
        }
        if (res!.ok) break;
        // "Auto" falls through to the next candidate on these statuses.
        if (!fail || !TRY_NEXT_MODEL.has(fail.status)) break;
      }

      if (!res?.ok) {
        throw friendlyError(fail ?? new HttpError(res?.status ?? 500), resolved);
      }
      onModel?.(resolved);
      const limit = getInputLimit(apiKey, resolved);

      // Parse the SSE stream: lines of "data: {json}" separated by blanks.
      // Chunks may split mid-line, so keep a leftover buffer.
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let usedTokens: number | undefined;

      const handleLine = (line: string) => {
        if (!line.startsWith('data:')) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        let json;
        try {
          json = JSON.parse(payload);
        } catch {
          // Partial or non-JSON data line - skip.
          return;
        }
        // The stream can deliver an error object mid-response - surface it.
        if (json?.error) {
          throw friendlyError(
            new HttpError(Number(json.error.code) || 500, json.error.message),
            resolved
          );
        }
        // Total tokens of this exchange = how much context the chat now uses.
        const total = json?.usageMetadata?.totalTokenCount;
        if (typeof total === 'number') usedTokens = total;
        const parts = json?.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) {
          if (typeof p.text === 'string') {
            full += p.text;
            onToken(p.text);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          handleLine(line);
        }
      }
      handleLine(buffer); // flush trailing partial line
      if (usedTokens !== undefined) {
        onContext?.({ usedTokens, maxTokens: await limit });
      }
      return full;
    },
  };
}
