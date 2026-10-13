import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
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
  LOCAL_CONTEXT_TOKENS,
  releaseLocalConversation,
  subscribeModelStatus,
  supportsLocalAI,
  unloadEngine,
  type ModelStatus,
} from '@/ai/local';
import { Dropdown, type DropdownOption } from '@/components/Dropdown';
import { Section } from '@/components/Section';
import { clearAllConversations } from '@/db/conversations';
import { useSettings } from '@/settings/SettingsContext';
import { buildSystemPrompt, type LocalBackend, type ProviderId } from '@/settings/storage';
import { useTheme, type Theme } from '@/theme';
import { confirmAction } from '@/utils/confirm';

const PROVIDERS: DropdownOption<ProviderId>[] = [
  { value: 'cloud', label: 'Cloud AI (Gemini)', description: 'Needs internet and a free API key' },
  { value: 'local', label: 'Local AI (Gemma 4 E2B)', description: 'Runs on the phone, works offline' },
];

const BACKENDS: DropdownOption<LocalBackend>[] = [
  {
    value: 'auto',
    label: 'Auto (recommended)',
    description: 'Uses the GPU when available, otherwise the CPU',
  },
  { value: 'gpu', label: 'GPU', description: 'Faster on supported phones' },
  { value: 'cpu', label: 'CPU', description: 'Works on every device' },
];

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Chatbot-only settings, opened from the gear in the chat. */
export default function ChatSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [promptDraft, setPromptDraft] = useState(settings.systemPrompt);

  const confirmClear = () => {
    confirmAction('Clear chat?', 'All messages will be deleted.', 'Clear', async () => {
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

      <Section title="System prompt" theme={theme}>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text },
          ]}
          value={promptDraft}
          onChangeText={setPromptDraft}
          onBlur={() => update('systemPrompt', promptDraft)}
          multiline
          placeholder="You are a helpful assistant."
          placeholderTextColor={theme.textSecondary}
        />
      </Section>

      <Pressable
        onPress={confirmClear}
        style={[styles.button, { borderColor: theme.danger, marginTop: 8 }]}
      >
        <Text style={{ color: theme.danger, fontWeight: '600' }}>Clear chat</Text>
      </Pressable>
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
        'Picks per message: Flash-Lite for quick replies, Flash for normal chats and attachments, Pro for complex requests',
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
        value={apiKeyDraft}
        onChangeText={setApiKeyDraft}
        onBlur={() => update('geminiApiKey', apiKeyDraft.trim())}
        placeholder="Paste your API key"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}>
        <Text style={[styles.link, { color: theme.tint }]}>
          Get a free API key at aistudio.google.com
        </Text>
      </Pressable>

      <View style={{ marginTop: 12 }}>
        <Dropdown
          label="Model"
          value={settings.geminiModel}
          options={modelOptions}
          onChange={(m) => update('geminiModel', m)}
          theme={theme}
        />
      </View>
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
  const [status, setStatus] = useState<ModelStatus>(getModelStatus());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeModelStatus(setStatus), []);

  if (!supportsLocalAI) {
    return (
      <Section title="Local AI (Gemma 4 E2B)" theme={theme}>
        <Text style={{ color: theme.textSecondary }}>
          Local AI runs only in the Android app. In the browser, use Cloud AI.
        </Text>
      </Section>
    );
  }

  const run = (action: () => Promise<void>) => {
    setError(null);
    action().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  const confirmDelete = () => {
    confirmAction('Delete model?', 'Frees ~2.6 GB of storage.', 'Delete', () => run(deleteModel));
  };

  const selectBackend = (b: LocalBackend) => {
    update('localBackend', b);
    // The backend is fixed at load time, so a loaded model must be reloaded.
    if (status.state === 'loaded') void unloadEngine();
  };

  const statusText = {
    not_downloaded: 'Not downloaded',
    downloading: `Downloading ${status.state === 'downloading' ? Math.round(status.progress * 100) : 0}%`,
    paused: 'Download paused',
    downloaded: `Downloaded (${status.state === 'downloaded' ? formatBytes(status.sizeBytes) : ''}) - not loaded`,
    loading: 'Loading into memory...',
    loaded: `Loaded and ready (${LOCAL_CONTEXT_TOKENS / 1024}k token context)`,
  }[status.state];

  const button = (label: string, onPress: () => void, color = theme.tint) => (
    <Pressable onPress={onPress} style={[styles.button, styles.flex, { borderColor: color }]}>
      <Text style={{ color, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Section title="Local AI (Gemma 4 E2B)" theme={theme}>
      <Text style={[styles.label, { color: theme.text }]}>Status: {statusText}</Text>
      {status.state === 'downloading' && (
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.tint, width: `${Math.round(status.progress * 100)}%` },
            ]}
          />
        </View>
      )}
      {status.state === 'loading' && <ActivityIndicator color={theme.tint} style={{ marginTop: 8 }} />}

      <View style={styles.buttonRow}>
        {(status.state === 'not_downloaded' || status.state === 'paused') &&
          button(status.state === 'paused' ? 'Resume download' : 'Download model', () => run(downloadModel))}
        {status.state === 'downloading' && button('Cancel', () => run(cancelDownload), theme.danger)}
        {status.state === 'downloaded' &&
          button('Load model', () =>
            run(() => loadLocalModel(settings.localBackend, buildSystemPrompt(settings)))
          )}
        {status.state === 'loaded' && button('Unload', () => run(unloadEngine))}
        {(status.state === 'downloaded' || status.state === 'loaded') &&
          button('Delete', confirmDelete, theme.danger)}
      </View>
      {error && <Text style={{ color: theme.danger, marginTop: 8 }}>{error}</Text>}

      {(status.state === 'not_downloaded' || status.state === 'paused') && (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          About 2.6 GB - use Wi-Fi. An ARM Android device with 4 GB+ RAM is recommended
          (6-8 GB for a good experience).
        </Text>
      )}

      <View style={{ marginTop: 12 }}>
        <Dropdown
          label="Inference backend"
          value={settings.localBackend}
          options={BACKENDS}
          onChange={selectBackend}
          theme={theme}
        />
      </View>
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
  link: { marginTop: 8, fontSize: 14 },
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },
  buttonRow: { flexDirection: 'row', gap: 10 },
  progressTrack: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 6 },
  hint: { fontSize: 13, marginTop: 8 },
});
