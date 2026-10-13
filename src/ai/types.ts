export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Local file URI of an attached image (cloud provider only). */
  imageUri?: string;
  /** Local file URI of a voice-message recording (cloud provider only). */
  audioUri?: string;
}

/** How much of the model's context window the conversation uses. */
export interface ContextUsage {
  usedTokens: number;
  /** Context window size; undefined if the provider doesn't report it. */
  maxTokens?: number;
  /** True when counted locally (chars / 4) rather than by the model. */
  estimated?: boolean;
}

export interface GenerateOptions {
  systemPrompt?: string;
  signal?: AbortSignal;
  /** Called once per streamed token/chunk. */
  onToken: (t: string) => void;
  conversationId: string;
  /** Called after a reply with the provider's real token usage, if known. */
  onContext?: (usage: ContextUsage) => void;
  /** Called with the model that answered once the response starts (cloud). */
  onModel?: (model: string) => void;
}

/**
 * An AI provider. `history` contains the whole conversation so far,
 * with the new user message last.
 *
 * To add a third provider: implement this interface in a new file under
 * src/ai/ and add one line in src/ai/index.ts -> getProvider().
 */
export interface ChatProvider {
  id: 'cloud' | 'local';
  label: string;
  requiresNetwork: boolean;
  generate(
    history: ChatMessage[],
    opts: GenerateOptions
  ): Promise<string>;
}
