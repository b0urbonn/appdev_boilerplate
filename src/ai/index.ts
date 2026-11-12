import type { Settings } from '../settings/storage';
import { createGeminiProvider } from './gemini';
import { createLocalProvider, getModelStatus } from './local';
import type { ChatProvider } from './types';

/**
 * Pick the active provider from settings.
 * Adding a third provider = one new file in src/ai/ + one line here.
 */
export function getProvider(settings: Settings): ChatProvider {
  if (settings.provider === 'local') {
    return createLocalProvider({
      backend: settings.localBackend,
      isModelDownloaded: () => {
        const s = getModelStatus();
        return s.state === 'downloaded' || s.state === 'loading' || s.state === 'loaded';
      },
    });
  }
  return createGeminiProvider({
    apiKey: settings.geminiApiKey,
    model: settings.geminiModel,
  });
}

export type { ChatMessage, ChatProvider, ContextUsage } from './types';
