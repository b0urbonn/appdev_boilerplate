import { useEffect, useState } from 'react';
import {
  getModelStatus,
  subscribeModelStatus,
  supportsLocalAI,
  type ModelStatus,
} from '@/ai/local';
import { useNetwork } from '@/hooks/useNetwork';
import { useSettings } from '@/settings/SettingsContext';

export interface AiStatus {
  /** Why the active provider can't answer right now, or null if it can. */
  problem: string | null;
  modelStatus: ModelStatus;
  isOnline: boolean;
}

/** Shared "can the selected AI answer right now?" check for any screen. */
export function useAiStatus(): AiStatus {
  const { settings } = useSettings();
  const { isOnline } = useNetwork();
  const [modelStatus, setModelStatus] = useState<ModelStatus>(getModelStatus());

  useEffect(() => subscribeModelStatus(setModelStatus), []);

  let problem: string | null = null;
  if (settings.provider === 'cloud') {
    if (!isOnline) problem = "You're offline - switch to Local AI in Settings.";
    else if (!settings.geminiApiKey) problem = 'No Gemini API key set.';
  } else if (!supportsLocalAI) {
    problem = 'Local AI runs only in the Android app.';
  } else if (modelStatus.state === 'loading') {
    problem = 'Loading the local model...';
  } else if (modelStatus.state === 'downloaded') {
    problem = 'Local model not loaded. Load it in Detector settings.';
  } else if (modelStatus.state !== 'loaded') {
    problem = 'Local model not downloaded.';
  }

  return { problem, modelStatus, isOnline };
}
