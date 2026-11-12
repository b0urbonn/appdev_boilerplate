// Voice recording for chat attachments, capped at two minutes.
// Records AAC ADTS so Gemini accepts the file as audio/aac.
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback } from 'react';
import { saveRecording } from '@/attachments/files';

/** Voice messages are capped at this length; chat.tsx stops at the cap. */
export const MAX_RECORDING_MS = 120_000;

const VOICE_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.aac',
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    extension: '.aac',
    outputFormat: 'aac_adts',
    audioEncoder: 'aac',
  },
};

export interface VoiceRecorder {
  recording: boolean;
  /** Elapsed recording time in milliseconds (updates while recording). */
  durationMs: number;
  /** Ask for mic permission and start recording. Throws when denied. */
  start(): Promise<void>;
  /** Finish and store the recording; null when nothing was captured. */
  stop(): Promise<{ uri: string; durationMs: number } | null>;
  /** Stop and throw the recording away. */
  cancel(): Promise<void>;
}

export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(VOICE_OPTIONS);
  const state = useAudioRecorderState(recorder);

  const start = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Microphone permission is needed for voice messages.');
    }
    await setAudioModeAsync({ allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stop = useCallback(async () => {
    // The web recorder throws (synchronously) on a second stop() call.
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {}
    const uri = recorder.uri;
    const durationMs = recorder.getStatus().durationMillis;
    if (!uri) return null;
    return { uri: await saveRecording(uri), durationMs };
  }, [recorder]);

  const cancel = useCallback(async () => {
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {}
  }, [recorder]);

  return {
    recording: state.isRecording,
    durationMs: state.durationMillis,
    start,
    stop,
    cancel,
  };
}
