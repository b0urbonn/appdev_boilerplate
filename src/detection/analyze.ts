// Runs one captured screen frame or a user-staged scan through the selected
// provider and parses the strict JSON verdict. The monitor path returns null
// for clean/unreadable/unavailable results; the manual-scan path returns
// safe verdicts too and throws readable errors the UI can show.
import NetInfo from '@react-native-community/netinfo';
import { getProvider, type ChatMessage } from '@/ai';
import { releaseLocalConversation } from '@/ai/local';
import { newId } from '@/db/client';
import type { MonitorFinding, MonitorResult } from '@/monitor/native';
import type { Settings } from '@/settings/storage';

export interface MonitorFrame {
  frameId: string;
  packageName: string;
  appLabel: string;
  imageUri?: string;
  screenText?: string;
  capturedAt?: number;
}

const DETECTION_SYSTEM_PROMPT = `You are Maalam's background safety monitor. You are shown a screenshot and the visible text captured from an Android app the user chose to protect.

Decide whether the screen contains a likely deepfake or AI-manipulated face, AI-generated imagery presented as real, or harmful content (hate speech, threats, harassment, sexual exploitation, self-harm, scams, dangerous misinformation).

Be conservative: ordinary photos, videos, game graphics, memes and normal app UI are safe. Only flag when there is a real, specific reason.

Reply with ONLY a JSON object, no markdown, no other text:
{"flagged":bool,"verdict":"deepfake"|"ai_generated"|"harmful"|"safe","confidence":0-100,"summary":str,"findings":[{"category":"deepfake"|"ai_generated"|"harmful","label":str,"confidence":0-100,"description":str}]}
Use verdict "safe" and an empty findings list when nothing is flagged.`;

const MANUAL_SCAN_PROMPT = `You are Maalam, an AI safety analyst. The user submitted content to check: an image, a video, an audio clip or a piece of text.

Assess it for:
- deepfake: a real person's face, body or voice that appears swapped, re-animated, lip-synced or otherwise manipulated.
- ai_generated: imagery, video, audio or text that appears to be produced by AI rather than captured or written by a person.
- harmful: hate speech, threats or violence, harassment, sexual exploitation, encouragement of self-harm, scams or fraud, or dangerous misinformation.

For images and video, look for artifacts such as warped or asymmetric features, unnatural skin, inconsistent edges around hair and jaw, distorted hands, teeth or text, mismatched lighting and shadows, and flicker or lip-sync drift between frames. For audio, listen for robotic or flat prosody, unnatural breathing or pauses, glitches and voice inconsistencies, and check what is said. For text, check the content itself and signs of scams such as urgency, payment requests or impersonation.

Be calibrated: ordinary photos, recordings and messages are safe. Detection is heuristic, so confidence must reflect real uncertainty; never use 100.

Reply with ONLY a JSON object, no markdown, no other text:
{"flagged":bool,"verdict":"deepfake"|"ai_generated"|"harmful"|"safe","confidence":0-100,"summary":str,"findings":[{"category":"deepfake"|"ai_generated"|"harmful","label":str,"confidence":0-100,"description":str}]}
"confidence" is how sure you are of the verdict, including when the verdict is "safe". Use an empty findings list when nothing is flagged. Keep "summary" to one or two plain sentences.`;

export type Verdict = 'deepfake' | 'ai_generated' | 'harmful' | 'safe';

export interface ParsedVerdict {
  flagged: boolean;
  verdict: Verdict;
  confidence: number;
  summary: string;
  findings: MonitorFinding[];
}

type RawResult = Omit<MonitorResult, 'detectionId'>;

const clampConfidence = (v: unknown) =>
  Math.max(0, Math.min(100, Math.round(typeof v === 'number' ? v : 0)));

const VALID_CATEGORIES = new Set(['deepfake', 'ai_generated', 'harmful']);
const VALID_VERDICTS = new Set([...VALID_CATEGORIES, 'safe']);

/** Parse the first {...} block of model output (```json fences tolerated). */
export function parseVerdict(text: string): ParsedVerdict | null {
  const cleaned = text.replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  const verdict: Verdict = VALID_VERDICTS.has(json.verdict as string)
    ? (json.verdict as Verdict)
    : 'safe';
  const rawFindings = Array.isArray(json.findings) ? json.findings : [];
  const findings: MonitorFinding[] = rawFindings
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
    .map((f) => ({
      category: VALID_CATEGORIES.has(f.category as string)
        ? (f.category as MonitorFinding['category'])
        : 'harmful',
      label: typeof f.label === 'string' && f.label.trim() ? f.label : 'Flagged content',
      confidence: clampConfidence(f.confidence),
      description: typeof f.description === 'string' ? f.description : '',
    }))
    .filter((f) => f.confidence > 0);
  return {
    flagged: json.flagged === true && verdict !== 'safe',
    verdict,
    confidence: clampConfidence(json.confidence),
    summary: typeof json.summary === 'string' ? json.summary : '',
    findings,
  };
}

/** Null when the chosen provider can't run right now (key/model/offline). */
async function providerOrNull(settings: Settings) {
  const provider = getProvider(settings);
  if (provider.requiresNetwork) {
    const net = await NetInfo.fetch().catch(() => null);
    if (net && (net.isConnected === false || net.isInternetReachable === false)) {
      return null;
    }
    if (!settings.geminiApiKey) return null;
  }
  return provider;
}

/**
 * Analyse one frame. Returns a flagged verdict, or null when the frame is
 * clean, the result can't be parsed, or the provider can't run (no API key,
 * model not downloaded, cloud provider offline).
 */
export async function analyzeFrame(
  frame: MonitorFrame,
  settings: Settings
): Promise<RawResult | null> {
  const provider = await providerOrNull(settings);
  if (!provider) return null;
  const conversationId = `monitor-${frame.frameId}`;
  const message: ChatMessage = {
    role: 'user',
    imageUri: frame.imageUri,
    content:
      `App being monitored: ${frame.appLabel} (${frame.packageName})\n` +
      `Visible text on screen:\n${frame.screenText?.trim() || '(none)'}\n\n` +
      'Inspect this screen and reply with the JSON verdict only.',
  };
  try {
    const output = await provider.generate([message], {
      systemPrompt: DETECTION_SYSTEM_PROMPT,
      conversationId,
      onToken: () => {},
    });
    const parsed = parseVerdict(output);
    if (!parsed || !parsed.flagged || parsed.confidence < 60) return null;
    return parsed as RawResult;
  } catch {
    return null;
  } finally {
    if (provider.id === 'local') {
      await releaseLocalConversation(conversationId).catch(() => {});
    }
  }
}

export interface ScanInput {
  kind: 'image' | 'video' | 'audio' | 'text';
  uri?: string;
  text?: string;
}

/**
 * Analyse a user-staged scan. Returns the parsed verdict including safe
 * results; throws a readable Error when the provider can't run or the reply
 * can't be parsed.
 */
export async function analyzeContent(
  input: ScanInput,
  settings: Settings,
  signal?: AbortSignal
): Promise<ParsedVerdict> {
  const provider = getProvider(settings);
  if (provider.requiresNetwork) {
    const net = await NetInfo.fetch().catch(() => null);
    if (net && (net.isConnected === false || net.isInternetReachable === false)) {
      throw new Error('You are offline. Connect or switch to Local AI in Detector settings.');
    }
    if (!settings.geminiApiKey) {
      throw new Error('No Gemini API key set. Add one in Detector settings.');
    }
  }
  const conversationId = `scan-${newId()}`;
  const content =
    input.kind === 'text'
      ? `Content type: text.\nText to check:\n${input.text ?? ''}\n\nReply with the JSON verdict only.`
      : `Content type: ${input.kind}.\nInspect the attached ${input.kind} and reply with the JSON verdict only.`;
  const message: ChatMessage = {
    role: 'user',
    content,
    imageUri: input.kind === 'image' ? input.uri : undefined,
    videoUri: input.kind === 'video' ? input.uri : undefined,
    audioUri: input.kind === 'audio' ? input.uri : undefined,
  };
  try {
    const output = await provider.generate([message], {
      systemPrompt: MANUAL_SCAN_PROMPT,
      conversationId,
      signal,
      onToken: () => {},
    });
    const parsed = parseVerdict(output);
    if (!parsed) {
      throw new Error("Maalam couldn't read the AI's answer. Please try again.");
    }
    return parsed;
  } finally {
    if (provider.id === 'local') {
      await releaseLocalConversation(conversationId).catch(() => {});
    }
  }
}
