import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  copyIntoScans,
  pickAudioFile,
  pickImage,
  pickVideo,
} from '@/attachments/files';
import { AudioChip } from '@/components/AudioChip';
import { Button } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { analyzeContent, type ScanInput } from '@/detection/analyze';
import { newId } from '@/db/client';
import { insertScan } from '@/db/scans';
import { useAiStatus } from '@/hooks/useAiStatus';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useSettings } from '@/settings/SettingsContext';
import { showMessage } from '@/utils/confirm';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Kind = ScanInput['kind'];

interface Staged {
  kind: Kind;
  uri?: string;
  text?: string;
  name?: string;
  size?: number;
}

const TYPES: { kind: Kind; icon: IconName; title: string; hint: string }[] = [
  { kind: 'image', icon: 'image-outline', title: 'Image', hint: 'Photo from your gallery' },
  { kind: 'video', icon: 'videocam-outline', title: 'Video', hint: 'Short clip, Gemini only' },
  { kind: 'audio', icon: 'mic-outline', title: 'Audio', hint: 'Record or choose a file' },
  { kind: 'text', icon: 'document-text-outline', title: 'Text', hint: 'Paste a message or post' },
];

function formatSize(bytes: number): string {
  if (bytes <= 0) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const { problem } = useAiStatus();
  const recorder = useVoiceRecorder();

  const [selected, setSelected] = useState<Kind | null>(null);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const isLocal = settings.provider === 'local';
  const busy = running || recorder.recording;
  // Staging stays enabled so the UI is explorable; only "Scan now" requires
  // a working provider (the warning card explains why).
  const typeDisabled = (kind: Kind) => busy || (kind === 'video' && isLocal);
  const typeHint = (kind: Kind, hint: string) =>
    kind === 'video' && isLocal ? 'Needs Cloud AI' : hint;

  const pick = async (kind: Kind) => {
    const previous = selected;
    setSelected(kind);
    let next: Staged | null = null;
    if (kind === 'image') {
      const uri = await pickImage().catch(() => null);
      if (uri) next = { kind, uri, name: uri.split('/').pop() ?? 'image' };
    } else if (kind === 'video') {
      const v = await pickVideo().catch(() => null);
      if (v) next = { kind, uri: v.uri, name: v.name, size: v.size };
    } else if (kind === 'audio') {
      const a = await pickAudioFile().catch(() => null);
      if (a) next = { kind, uri: a.uri, name: a.name, size: a.size };
    }
    // A cancelled picker keeps whatever was staged before and the tile that matches it.
    if (next) setStaged(next);
    else if (kind !== 'audio') setSelected(previous);
  };

  const choose = (kind: Kind) => {
    if (kind === 'text') {
      setSelected(kind);
      setStaged({ kind, text: staged?.kind === 'text' ? staged.text : '' });
    } else if (kind === 'audio') {
      setSelected(kind);
      if (staged?.kind !== 'audio') setStaged(null);
    } else {
      void pick(kind);
    }
  };

  const record = async () => {
    if (recorder.recording) {
      const r = await recorder.stop().catch(() => null);
      if (r?.uri) setStaged({ kind: 'audio', uri: r.uri, name: 'Voice recording' });
      return;
    }
    try {
      await recorder.start();
    } catch (e) {
      showMessage('Microphone', e instanceof Error ? e.message : 'Recording failed.');
    }
  };

  const run = async () => {
    if (!staged || running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    try {
      const result = await analyzeContent(
        { kind: staged.kind, uri: staged.uri, text: staged.text },
        settings,
        controller.signal
      );
      const id = newId();
      const mediaUri = staged.uri ? await copyIntoScans(staged.uri, id) : null;
      await insertScan({
        id,
        kind: staged.kind,
        mediaUri,
        text: staged.kind === 'text' ? staged.text ?? '' : null,
        verdict: result.verdict,
        confidence: result.confidence,
        summary: result.summary,
        findings: result.findings,
        provider: settings.provider,
        createdAt: Date.now(),
      });
      setStaged(null);
      setSelected(null);
      router.push(`/scans/${id}` as Href);
    } catch (e) {
      if (!controller.signal.aborted) {
        showMessage('Scan failed', e instanceof Error ? e.message : 'Please try again.');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const canRun = !!staged && (staged.kind === 'text' ? !!staged.text?.trim() : !!staged.uri) && !problem;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.text }]}>Scan</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Check an image, video, audio clip or message for deepfakes, AI generation or harmful content.
      </Text>

      {problem && (
        <View style={[styles.warnCard, { backgroundColor: theme.card, borderColor: theme.warning }]}>
          <Ionicons name="alert-circle-outline" size={22} color={theme.warning} />
          <Text style={[styles.flex, { color: theme.text, fontSize: 14 }]}>{problem}</Text>
          <Button
            label="Set up AI"
            variant="secondary"
            onPress={() => router.push('/chat-settings' as Href)}
          />
        </View>
      )}

      <View style={styles.grid}>
        {TYPES.map((t) => {
          const disabled = typeDisabled(t.kind);
          const active = selected === t.kind;
          return (
            <SmoothPressable
              key={t.kind}
              accessibilityRole="button"
              accessibilityLabel={`${t.title}. ${typeHint(t.kind, t.hint)}`}
              accessibilityState={{ disabled, selected: active }}
              disabled={disabled}
              onPress={() => choose(t.kind)}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: theme.card,
                  borderColor: active ? theme.tint : theme.border,
                  opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
                },
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: theme.buttonSecondary }]}>
                <Ionicons name={t.icon} size={24} color={theme.tint} />
              </View>
              <Text style={[styles.tileTitle, { color: theme.text }]}>{t.title}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'center' }}>
                {typeHint(t.kind, t.hint)}
              </Text>
            </SmoothPressable>
          );
        })}
      </View>

      {selected === 'text' && (
        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TextInput
            accessibilityLabel="Text to scan"
            multiline
            numberOfLines={5}
            maxLength={5000}
            editable={!busy}
            placeholder="Paste the message or post here"
            placeholderTextColor={theme.textSecondary}
            onChangeText={(v) => setStaged({ kind: 'text', text: v })}
            value={staged?.kind === 'text' ? staged.text ?? '' : ''}
            style={[styles.input, { color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.border }]}
          />
          <Text style={{ color: theme.textSecondary, fontSize: 12, alignSelf: 'flex-end' }}>
            {staged?.kind === 'text' ? staged.text?.length ?? 0 : 0}/5000
          </Text>
        </View>
      )}

      {staged && staged.kind !== 'text' && (
        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {staged.kind === 'image' && staged.uri && (
            <Image source={{ uri: staged.uri }} style={styles.preview} resizeMode="cover" />
          )}
          {staged.kind === 'video' && (
            <View style={styles.fileRow}>
              <View style={[styles.fileIcon, { backgroundColor: theme.buttonSecondary }]}>
                <Ionicons name="videocam-outline" size={24} color={theme.tint} />
              </View>
              <View style={styles.flex}>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                  {staged.name}
                </Text>
                {!!staged.size && (
                  <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{formatSize(staged.size)}</Text>
                )}
              </View>
            </View>
          )}
          {staged.kind === 'audio' && (
            <View style={styles.fileRow}>
              {staged.uri && <AudioChip uri={staged.uri} isUser={false} />}
              <Text style={[styles.flex, { color: theme.text, fontSize: 14 }]} numberOfLines={1}>
                {staged.name}
              </Text>
            </View>
          )}
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel="Remove staged content"
            onPress={() => {
              if (staged.kind !== 'audio') setSelected(null);
              setStaged(null);
            }}
            disabled={busy}
            hitSlop={8}
          >
            <Text style={{ color: theme.danger, fontSize: 13, fontWeight: '600' }}>Remove</Text>
          </SmoothPressable>
        </View>
      )}

      {selected === 'audio' && !staged && (
        <View style={[styles.panel, styles.audioPanel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Button
            label={recorder.recording ? `Stop (${Math.floor(recorder.durationMs / 1000)}s)` : 'Record'}
            icon={recorder.recording ? 'stop-outline' : 'mic-outline'}
            variant={recorder.recording ? 'destructive' : 'secondary'}
            onPress={() => void record()}
            disabled={!!problem && !recorder.recording}
            style={styles.flex}
          />
          {!recorder.recording && (
            <Button
              label="Choose file"
              icon="folder-open-outline"
              variant="secondary"
              onPress={() => void pick('audio')}
              style={styles.flex}
            />
          )}
        </View>
      )}

      {(staged || selected === 'text') && (
        <View style={styles.actions}>
          <Button
            label={running ? 'Analysing…' : 'Scan now'}
            icon="scan-outline"
            loading={running}
            disabled={!canRun || running}
            onPress={() => void run()}
          />
          {running && (
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => abortRef.current?.abort()}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12 },
  flex: { flex: 1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: 8 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: -6 },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 6,
    padding: 16,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontSize: 15, fontWeight: '600' },
  panel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  audioPanel: { flexDirection: 'row' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  preview: { width: '100%', height: 200, borderRadius: 12 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: 10 },
});
