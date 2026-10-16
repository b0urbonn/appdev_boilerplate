import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AUTO_MODEL, listGeminiModels } from '@/ai/gemini';
import {
  cancelDownload,
  deleteModel,
  downloadModel,
  getModelStatus,
  loadLocalModel,
  pauseDownload,
  releaseLocalConversation,
  subscribeModelStatus,
  supportsLocalAI,
  unloadEngine,
  type ModelStatus,
} from '@/ai/local';
import { Dropdown, type DropdownOption } from '@/components/Dropdown';
import { Button } from '@/components/Button';
import { LocalHardwareStatus } from '@/components/LocalHardwareStatus';
import { Section } from '@/components/Section';
import { clearAllConversations } from '@/db/conversations';
import { useLocalDevice, useSettings } from '@/settings/SettingsContext';
import { buildSystemPrompt, type LocalBackend, type ProviderId } from '@/settings/storage';
import { useTheme, type Theme } from '@/theme';
import { confirmAction, showMessage } from '@/utils/confirm';

const PROVIDERS: DropdownOption<ProviderId>[] = [
  { value: 'cloud', label: 'Cloud AI (Gemini)', description: 'Needs internet and a free API key' },
  { value: 'local', label: 'Local AI', description: 'Runs on the phone, works offline' },
];

const BACKENDS: DropdownOption<LocalBackend>[] = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Uses detected hardware and total RAM',
  },
  { value: 'npu', label: 'NPU', description: 'Detected accelerator; CPU backup' },
  { value: 'gpu', label: 'GPU', description: 'OpenCL GPU detected; CPU backup' },
  { value: 'cpu', label: 'CPU', description: 'Compatible processor' },
];

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTransferBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRemainingTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'Estimating time remaining';
  if (seconds < 60) return `${Math.max(1, seconds)} sec remaining`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min remaining`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours} hr ${remainingMinutes} min remaining`;
  const days = Math.floor(hours / 24);
  return `${days} day ${hours % 24} hr remaining`;
}

/** Detector settings, opened from the gear in the scan screen. */
export default function ChatSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [promptDraft, setPromptDraft] = useState(settings.systemPrompt);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const savePrompt = async () => {
    if (savingPrompt) return;
    setSavingPrompt(true);
    try {
      await update('systemPrompt', promptDraft);
      setPromptSaved(true);
      Keyboard.dismiss();
    } catch (error) {
      showMessage('Unable to save prompt', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSavingPrompt(false); }
  };

  const confirmClear = () => {
    confirmAction('Clear scans?', 'All messages will be deleted.', 'Clear', async () => {
      await clearAllConversations();
      await releaseLocalConversation('main');
      router.back();
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Section title="AI" theme={theme}>
        <Dropdown
          label="AI provider"
          value={settings.provider}
          options={PROVIDERS}
          onChange={(p) => update('provider', p)}
          theme={theme}
        />
      </Section>

      {settings.provider === 'cloud' ? <CloudSection theme={theme} /> : <LocalSection theme={theme} />}

      <Section title="Detection prompt" theme={theme}>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text },
          ]}
          accessibilityLabel="System prompt"
          value={promptDraft}
          onChangeText={text => { setPromptDraft(text); setPromptSaved(false); }}
          editable={!savingPrompt}
          multiline
          placeholder="Customize how Maalam analyzes content."
          placeholderTextColor={theme.textSecondary}
        />
        <Button label={promptSaved ? 'Saved' : 'Save'} icon={promptSaved ? 'checkmark' : 'save-outline'} onPress={savePrompt} loading={savingPrompt} disabled={promptDraft === settings.systemPrompt} style={{ marginTop: 12 }} />
      </Section>

      <Button label="Clear scans" icon="trash-outline" variant="destructiveSecondary" onPress={confirmClear} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

/** Gemini API key + model picker. */
function CloudSection({ theme }: { theme: Theme }) {
  const { settings, update } = useSettings();
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.geminiApiKey);
  // Models available to the saved API key (or why they couldn't be loaded).
  const [modelList, setModelList] = useState<{
    key: string;
    models?: string[];
    error?: string;
  } | null>(null);

  // Fetch the models this key can use whenever the saved key changes.
  useEffect(() => {
    const key = settings.geminiApiKey;
    if (!key) return;
    let cancelled = false;
    listGeminiModels(key)
      .then((models) => !cancelled && setModelList({ key, models }))
      .catch((e) => {
        const error = e instanceof Error ? e.message : 'Failed to load models.';
        if (!cancelled) setModelList({ key, error });
      });
    return () => {
      cancelled = true;
    };
  }, [settings.geminiApiKey]);

  const current = modelList?.key === settings.geminiApiKey ? modelList : null;
  const loadingModels = !!settings.geminiApiKey && !current;
  const models = current?.models ?? [];

  const modelOptions: DropdownOption<string>[] = [
    {
      value: AUTO_MODEL,
      label: 'Auto (best available)',
      description:
        'Matches each message; skips limited models',
    },
    // Keep a manually chosen model visible even if the list hasn't loaded.
    ...[...new Set([...models, settings.geminiModel])]
      .filter((m) => m !== AUTO_MODEL)
      .map((m) => ({ value: m, label: m })),
  ];

  return (
    <Section title="Cloud AI (Gemini)" theme={theme}>
      <Text style={[styles.label, { color: theme.text }]}>API key</Text>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text },
        ]}
        accessibilityLabel="Gemini API key"
        value={apiKeyDraft}
        onChangeText={setApiKeyDraft}
        onBlur={() => update('geminiApiKey', apiKeyDraft.trim())}
        placeholder="Paste your API key"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button label="Get API key" icon="open-outline" variant="secondary" onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />

      <View style={{ marginTop: 12 }}>
        <Dropdown
          label="Model"
          value={settings.geminiModel}
          options={modelOptions}
          onChange={(m) => update('geminiModel', m)}
          theme={theme}
        />
      </View>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>Switches automatically if a model is limited.</Text>
      {loadingModels && <ActivityIndicator color={theme.tint} />}
      {current?.error && <Text style={{ color: theme.danger }}>{current.error}</Text>}
      {!settings.geminiApiKey && (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Add an API key to see the models available to you.
        </Text>
      )}
    </Section>
  );
}

/** Gemma model download, load/unload and backend. */
function LocalSection({ theme }: { theme: Theme }) {
  const { settings, update } = useSettings();
  const { localDevice } = useLocalDevice();
  const [status, setStatus] = useState<ModelStatus>(getModelStatus());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeModelStatus(setStatus), []);

  if (!supportsLocalAI) {
    return (
      <Section title="Local AI" theme={theme}>
        <Text style={{ color: theme.textSecondary }}>
          Local AI runs only in the Android app. In the browser, use Cloud AI.
        </Text>
      </Section>
    );
  }

  const device = localDevice.state === 'ready' ? localDevice.report : null;
  const backends = BACKENDS.filter((option) => option.value === 'auto' || !!device?.compatible && (
    option.value === 'cpu' || option.value === 'npu' && device.npuDetected || option.value === 'gpu' && device.gpuAvailable
  ));
  const selectedBackend = backends.some((option) => option.value === settings.localBackend) ? settings.localBackend : 'auto';

  const run = (action: () => Promise<void>) => {
    setError(null);
    action().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  const confirmDelete = () => {
    confirmAction('Delete model?', 'Frees ~2.6 GB of storage.', 'Delete', () => run(deleteModel));
  };

  const selectBackend = (b: LocalBackend) => {
    if (b === settings.localBackend) return;
    update('localBackend', b);
    // The backend is fixed at load time, so a loaded model must be reloaded.
    if (status.state === 'loaded') void unloadEngine();
  };

  const statusText = {
    not_downloaded: 'Not downloaded',
    downloading: `Downloading ${status.state === 'downloading' ? (status.progress * 100).toFixed(1) : 0}%`,
    paused: `Download paused ${(status.state === 'paused' ? status.progress * 100 : 0).toFixed(1)}%`,
    downloaded: `Downloaded (${status.state === 'downloaded' ? formatBytes(status.sizeBytes) : ''}) - not loaded`,
    loading: 'Loading…',
    loaded: 'Ready',
  }[status.state];

  const button = (label: string, onPress: () => void, destructive = false) => (
    <Button key={label} label={label} onPress={onPress} variant={destructive ? 'destructiveSecondary' : label === 'Unload' ? 'secondary' : 'primary'} style={styles.flex} />
  );

  return (
    <Section title="Local AI" theme={theme}>
      <LocalHardwareStatus loaded={status.state === 'loaded'} />
      <Text style={[styles.label, { color: theme.text }]}>Status: {statusText}</Text>
      {(status.state === 'downloading' || status.state === 'paused') && (
        <>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.tint, width: `${Math.round(status.progress * 100)}%` },
              ]}
            />
          </View>
          {status.state === 'downloading' && (
            <Text style={[styles.hint, { color: theme.textSecondary, marginTop: 8 }]}>
              {formatTransferBytes(status.downloadedBytes)} of {formatTransferBytes(status.totalBytes)}
              {'  ·  '}
              {status.speedBytesPerSecond > 0
                ? `${formatTransferBytes(status.speedBytesPerSecond)}/s`
                : 'Measuring speed'}
              {'  ·  '}
              {formatRemainingTime(status.etaSeconds)}
            </Text>
          )}
        </>
      )}
      {status.state === 'loading' && <ActivityIndicator color={theme.tint} style={{ marginTop: 8 }} />}

      <View style={styles.buttonRow}>
        {(status.state === 'not_downloaded' || status.state === 'paused') &&
          button(status.state === 'paused' ? 'Resume download' : 'Download model', () => run(downloadModel))}
        {status.state === 'downloading' && (
          <>
            {button('Pause', () => run(pauseDownload))}
            {button('Cancel', () => run(cancelDownload), true)}
          </>
        )}
        {status.state === 'paused' && button('Cancel', () => run(cancelDownload), true)}
        {status.state === 'downloaded' &&
          button('Load model', () =>
            run(() => loadLocalModel(selectedBackend, buildSystemPrompt(settings)))
          )}
        {status.state === 'loaded' && button('Unload', () => run(unloadEngine))}
        {(status.state === 'downloaded' || status.state === 'loaded') &&
          button('Delete', confirmDelete, true)}
      </View>
      {error && <Text style={{ color: theme.danger, marginTop: 8 }}>{error}</Text>}

      {(status.state === 'not_downloaded' || status.state === 'paused') && (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {status.state === 'paused'
            ? 'Progress saved. Resume anytime.'
            : '2.6 GB download. Wi-Fi recommended.'}
        </Text>
      )}

      <View style={{ marginTop: 12 }}>
        <Dropdown
          label="Inference backend"
          value={selectedBackend}
          options={backends}
          onChange={selectBackend}
          theme={theme}
        />
      </View>
      {(settings.localBackend === 'auto' || settings.localBackend === 'npu') && (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Model acceleration is verified when loading.
        </Text>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  flex: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  progressTrack: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 6 },
  hint: { fontSize: 13, marginTop: 8 },
});
