import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProvider } from '@/ai';
import {
  LOCAL_CONTEXT_TOKENS,
  releaseLocalConversation,
} from '@/ai/local';
import type { ChatMessage, ContextUsage } from '@/ai/types';
import { pickImage } from '@/attachments/files';
import { Banner } from '@/components/Banner';
import { ChatInput } from '@/components/ChatInput';
import { ContextRing } from '@/components/ContextRing';
import { IconButton } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { MessageBubble } from '@/components/MessageBubble';
import {
  clearAllConversations,
  ensureConversation,
  touchConversation,
} from '@/db/conversations';
import {
  insertMessage,
  listMessages,
  setMessageStatus,
  updateMessageContent,
  type MessageRow,
} from '@/db/messages';
import { useAiStatus } from '@/hooks/useAiStatus';
import {
  MAX_RECORDING_MS,
  useVoiceRecorder,
} from '@/hooks/useVoiceRecorder';
import { useSettings } from '@/settings/SettingsContext';
import { buildSystemPrompt } from '@/settings/storage';
import { useTheme } from '@/theme';
import { confirmAction, showMessage } from '@/utils/confirm';

/** Streamed content is written to SQLite at most this often. */
const DB_WRITE_THROTTLE_MS = 500;
/** The app has a single chat; all messages belong to this conversation. */
const id = 'main';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Starter prompts shown on an empty chat. Edit these for your app. */
export const SUGGESTIONS: { icon: IconName; label: string; prompt: string }[] = [
  { icon: 'bulb-outline', label: 'Explain a topic', prompt: 'Explain photosynthesis in simple terms.' },
  { icon: 'help-circle-outline', label: 'Quiz me', prompt: 'Give me a 5-question quiz about world geography.' },
  { icon: 'calendar-outline', label: 'Plan my study week', prompt: 'Help me make a study plan for this week.' },
  { icon: 'create-outline', label: 'Improve my writing', prompt: 'Help me improve this paragraph: ' },
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { settings, ready } = useSettings();
  const { problem, modelStatus } = useAiStatus();

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingAudio, setPendingAudio] = useState<{
    uri: string;
    durationMs: number;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  // Real token usage reported by the provider after its last reply.
  const [reported, setReported] = useState<{ provider: string; usage: ContextUsage } | null>(null);
  // Model "Auto" routed the last reply to (cloud only).
  const [lastModel, setLastModel] = useState<string | null>(null);
  const voice = useVoiceRecorder();

  const abortRef = useRef<AbortController | null>(null);
  const lastDbWriteRef = useRef(0);
  const provider = useMemo(
    () => (ready ? getProvider(settings) : null),
    [ready, settings]
  );

  // ── Load messages on focus (also after "Clear chat" in settings) and fail
  // any 'pending' rows left over from a killed run ──
  useFocusEffect(
    useCallback(() => {
      // Mid-generation the on-screen state is newer than the DB; keep it.
      if (abortRef.current) return;
      (async () => {
        await ensureConversation(id);
        const rows = await listMessages(id);
        const fixed = await Promise.all(
          rows.map(async (m) => {
            if (m.status === 'pending') {
              await setMessageStatus(m.id, 'error', 'Generation interrupted.');
              return { ...m, status: 'error' as const, error: 'Generation interrupted.' };
            }
            return m;
          })
        );
        setMessages(fixed);
        if (fixed.length === 0) setReported(null); // chat was cleared
      })();
    }, [])
  );

  /** Write streamed content to the DB, throttled; final write on done. */
  const persistContent = useCallback(
    (messageId: string, content: string, force = false) => {
      const now = Date.now();
      if (!force && now - lastDbWriteRef.current < DB_WRITE_THROTTLE_MS) return;
      lastDbWriteRef.current = now;
      void updateMessageContent(messageId, content);
    },
    []
  );

  const updateRow = useCallback((row: MessageRow) => {
    setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
  }, []);

  /**
   * Run one generation for `assistantRow`.
   * `history` = prior done messages plus the new user message, in order.
   */
  const runGeneration = useCallback(
    async (assistantRow: MessageRow, history: ChatMessage[]) => {
      if (!provider) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setGenerating(true);

      let content = '';
      let streamTimer: ReturnType<typeof setTimeout> | undefined;
      const flushStream = () => {
        if (streamTimer) clearTimeout(streamTimer);
        streamTimer = undefined;
        const snapshot = content;
        setMessages(prev => prev.map(m => m.id === assistantRow.id ? { ...m, content: snapshot } : m));
        persistContent(assistantRow.id, snapshot);
      };
      try {
        await provider.generate(history, {
          systemPrompt: buildSystemPrompt(settings),
          signal: controller.signal,
          conversationId: id,
          onContext: (usage) => setReported({ provider: provider.id, usage }),
          onModel: (m) => setLastModel(m),
          onReset: () => {
            if (streamTimer) clearTimeout(streamTimer);
            streamTimer = undefined;
            content = '';
            setMessages(prev => prev.map(m => m.id === assistantRow.id ? { ...m, content: '' } : m));
            persistContent(assistantRow.id, '', true);
          },
          onToken: (t) => {
            content += t;
            if (!streamTimer) streamTimer = setTimeout(flushStream, 50);
          },
        });
      } catch (e) {
        if (streamTimer) clearTimeout(streamTimer);
        if (!controller.signal.aborted) {
          const errText =
            e instanceof Error ? e.message : 'Generation failed.';
          await setMessageStatus(assistantRow.id, 'error', errText);
          updateRow({ ...assistantRow, content, status: 'error', error: errText });
          setGenerating(false);
          abortRef.current = null;
          return;
        }
        // Aborted mid-flight: fall through and keep the partial content.
      }

      if (streamTimer) clearTimeout(streamTimer);
      persistContent(assistantRow.id, content, true);
      await setMessageStatus(assistantRow.id, 'done');
      await updateMessageContent(assistantRow.id, content);
      updateRow({ ...assistantRow, content, status: 'done', error: null });
      await touchConversation(id);
      setGenerating(false);
      abortRef.current = null;
    },
    [provider, settings, persistContent, updateRow]
  );

  const attachImage = useCallback(async () => {
    try {
      const uri = await pickImage();
      if (uri) setPendingImage(uri);
    } catch (e) {
      showMessage('Unable to attach image', e instanceof Error ? e.message : 'Please try again.');
    }
  }, []);

  const startRecording = useCallback(() => {
    voice.start().catch((e) => showMessage('Unable to record', e instanceof Error ? e.message : 'Please try again.'));
  }, [voice]);

  const finishRecording = useCallback(async () => {
    try {
      const done = await voice.stop();
      if (done) setPendingAudio(done);
    } catch (e) {
      showMessage('Unable to save recording', e instanceof Error ? e.message : 'Please try again.');
    }
  }, [voice]);

  const cancelRecording = useCallback(() => {
    voice.cancel().catch(() => {});
  }, [voice]);

  // Finish (keep) the recording automatically when it hits the cap.
  const autoStoppedRef = useRef(false);
  useEffect(() => {
    if (!voice.recording) {
      autoStoppedRef.current = false;
      return;
    }
    if (voice.durationMs >= MAX_RECORDING_MS && !autoStoppedRef.current) {
      autoStoppedRef.current = true;
      void finishRecording();
    }
  }, [voice.recording, voice.durationMs, finishRecording]);

  const send = useCallback(async () => {
    const text = input.trim();
    const image = pendingImage;
    const audio = pendingAudio;
    if ((!text && !image && !audio) || !provider || generating) return;
    setGenerating(true);
    await ensureConversation(id);

    const userRow = await insertMessage({
      conversation_id: id,
      role: 'user',
      content: text,
      status: 'done',
      error: null,
      provider: provider.id,
      image_uri: image,
      audio_uri: audio?.uri ?? null,
    });
    const assistantRow = await insertMessage({
      conversation_id: id,
      role: 'assistant',
      content: '',
      status: 'pending',
      error: null,
      provider: provider.id,
      image_uri: null,
      audio_uri: null,
    });
    setInput('');
    setPendingImage(null);
    setPendingAudio(null);
    setMessages((prev) => [...prev, userRow, assistantRow]);

    await touchConversation(id);

    const history: ChatMessage[] = [
      ...messages
        .filter(
          (m) =>
            m.status === 'done' &&
            (m.content.length > 0 || m.image_uri || m.audio_uri)
        )
        .map((m) => ({
          role: m.role,
          content: m.content,
          imageUri: m.image_uri ?? undefined,
          audioUri: m.audio_uri ?? undefined,
        })),
      {
        role: 'user',
        content: text,
        imageUri: image ?? undefined,
        audioUri: audio?.uri ?? undefined,
      },
    ];
    await runGeneration(assistantRow, history);
  }, [input, pendingImage, pendingAudio, provider, generating, messages, runGeneration]);

  const retry = useCallback(
    async (row: MessageRow) => {
      if (generating) return;
      const idx = messages.findIndex((m) => m.id === row.id);
      if (idx < 0) return;
      const history: ChatMessage[] = messages
        .slice(0, idx)
        .filter(
          (m) =>
            m.status === 'done' &&
            (m.content.length > 0 || m.image_uri || m.audio_uri)
        )
        .map((m) => ({
          role: m.role,
          content: m.content,
          imageUri: m.image_uri ?? undefined,
          audioUri: m.audio_uri ?? undefined,
        }));
      const pendingRow: MessageRow = { ...row, status: 'pending', error: null };
      await setMessageStatus(row.id, 'pending', null);
      updateRow(pendingRow);
      await runGeneration(pendingRow, history);
    },
    [generating, messages, runGeneration, updateRow]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    confirmAction('Clear chat?', 'All messages will be deleted and the AI memory reset.', 'Clear', async () => {
      await clearAllConversations();
      await releaseLocalConversation(id);
      await ensureConversation(id);
      // Reset only after the engine has released its memory.
      setMessages([]);
      setPendingImage(null);
      setPendingAudio(null);
      setReported(null);
    });
  }, []);

  const openSettings = () => router.push('/chat-settings' as Href);

  // ── Banner / send gating ────────────────────────────────────────────────
  const banner = problem ? (
    <Banner
      text={problem}
      actionLabel="Open Settings"
      onPress={openSettings}
    />
  ) : null;
  const sendDisabled = problem !== null;

  // Prefer the provider's real count; until one arrives, estimate ~4 chars per token.
  const context: ContextUsage =
    reported && reported.provider === provider?.id
      ? reported.usage
      : {
          // A fresh chat means an empty memory, so nothing is used yet.
          usedTokens:
            messages.length === 0
              ? 0
              : Math.ceil(
                  (buildSystemPrompt(settings).length +
                    messages.reduce((n, m) => n + m.content.length, 0)) / 4
                ),
          maxTokens: provider?.id === 'local' ? LOCAL_CONTEXT_TOKENS : undefined,
          estimated: true,
        };

  const pendingLabel =
    provider?.id === 'local' && modelStatus.state !== 'loaded'
      ? 'Loading model...'
      : 'Generating...';

  // Status dot + line under the title: green when ready, amber while the
  // local model is loading/downloading, red otherwise.
  const providerLabel =
    settings.provider === 'cloud'
      ? lastModel
        ? `Gemini · ${lastModel}`
        : 'Gemini · Cloud'
      : 'Local AI';
  const modelLoading =
    problem === 'Loading the local model...' || modelStatus.state === 'loading';
  let statusColor = theme.danger;
  let statusText = `${providerLabel} · not ready`;
  if (problem === null) {
    statusColor = theme.success;
    statusText = providerLabel;
  } else if (modelLoading || modelStatus.state === 'downloading') {
    statusColor = theme.warning;
    statusText = modelLoading ? 'Loading model...' : `${providerLabel} · not ready`;
  }

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <IconButton icon="chevron-back" label="Back to Home" onPress={() => router.navigate('/' as Href)} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: theme.text }]}>AI Chat</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 12 }}>
              {statusText}
            </Text>
          </View>
        </View>
        <ContextRing usage={context} theme={theme} />
        <IconButton icon="trash-outline" label="Clear chat" onPress={clearChat} disabled={generating || messages.length === 0} />
        <IconButton icon="settings-outline" label="Chat settings" onPress={openSettings} />
      </View>
      {banner}
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyAvatar, { backgroundColor: theme.buttonPrimary }]}>
            <Ionicons name="sparkles" size={30} color="#FFF" />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Hi {settings.nickname || 'there'}, how can I help?
          </Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Ask anything. Your chat is saved on this device.
          </Text>
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <SmoothPressable
                key={s.label}
                disabled={problem !== null}
                onPress={() => setInput(s.prompt)}
                style={[
                  styles.chip,
                  { backgroundColor: theme.buttonSecondary, borderColor: theme.buttonSecondary },
                  problem !== null && styles.chipDisabled,
                ]}
              >
                <Ionicons name={s.icon} size={18} color={theme.tint} />
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '500' }}>
                  {s.label}
                </Text>
              </SmoothPressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          inverted
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              pendingLabel={pendingLabel}
              onRetry={item.role === 'assistant' ? retry : undefined}
            />
          )}
        />
      )}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => { void send().catch((error) => { setGenerating(false); showMessage('Unable to send message', error instanceof Error ? error.message : 'Please try again.'); }); }}
        onStop={stop}
        disabled={sendDisabled}
        generating={generating}
        imageUri={pendingImage}
        onPickImage={provider ? attachImage : undefined}
        onRemoveImage={() => setPendingImage(null)}
        audio={pendingAudio}
        onRemoveAudio={() => setPendingAudio(null)}
        recording={voice.recording}
        recordingMs={voice.durationMs}
        onStartRecording={provider ? startRecording : undefined}
        onStopRecording={finishRecording}
        onCancelRecording={cancelRecording}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, marginTop: 6, textAlign: 'center' },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipDisabled: { opacity: 0.5 },
  list: { paddingVertical: 12 },
});
