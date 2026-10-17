import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ChatMessage } from '@/ai';
import { pickImage, pickVideo, pickAudioFile } from '@/attachments/files';
import { readClipboardText } from '@/attachments/clipboard';
import { captureScreen } from '@/attachments/captureScreen';
import { Button } from '@/components/Button';
import { Popup } from '@/components/Popup';
import { quickChat } from '@/detection/quickChat';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

/** The floating shortcut's animated composer; shared with the monitor preview. */
export function QuickChatPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [attachment, setAttachment] = useState<Partial<ChatMessage> | null>(null);
  const picking = useRef(false);
  const visibleRef = useRef(visible);
  const inputRef = useRef<TextInput | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    visibleRef.current = false;
    abortRef.current?.abort();
  }, []);
  useEffect(() => {
    visibleRef.current = visible;
    if (!visible) {
      abortRef.current?.abort();
    }
  }, [visible]);

  const send = async (override?: Partial<ChatMessage>) => {
    const submittedAttachment = override ?? attachment;
    const prompt = input.trim();
    if ((!prompt && !submittedAttachment) || abortRef.current || picking.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError('');
    try {
      const submitted = prompt || 'Inspect this attached content for manipulation and harmful content.';
      const reply = await quickChat(submitted, messages, settings, `${Date.now()}`, controller.signal, submittedAttachment ?? {});
      if (!controller.signal.aborted) {
        setMessages(previous => [...previous.slice(-4), { ...submittedAttachment, role: 'user', content: submitted }, { role: 'assistant', content: reply }]);
        setInput('');
        setAttachment(null);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to check this content. Please try again.');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const pasteLink = async () => {
    if (busy) return;
    setError('');
    try {
      const text = await readClipboardText();
      if (visibleRef.current) { setInput(text); inputRef.current?.focus(); }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not paste. Touch and hold the message field, then choose Paste.');
      inputRef.current?.focus();
    }
  };

  const attach = async (kind: 'image' | 'video' | 'audio' | 'screen') => {
    if (abortRef.current || picking.current) return;
    picking.current = true;
    setBusy(true);
    setCapturing(kind === 'screen');
    setError('');
    try {
      if (kind === 'video' && settings.provider === 'local') throw new Error('Use Cloud AI for video clips, or attach a screenshot for Local AI.');
      const uri = kind === 'image' ? await pickImage() : kind === 'screen' ? await captureScreen() : (kind === 'video' ? await pickVideo() : await pickAudioFile())?.uri;
      setCapturing(false);
      if (uri && visibleRef.current) {
        const media = kind === 'video' ? { videoUri: uri } : kind === 'audio' ? { audioUri: uri } : { imageUri: uri };
        setAttachment(media);
        if (kind === 'screen') { picking.current = false; await send(media); }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not attach content.');
    } finally { picking.current = false; setCapturing(false); setBusy(false); }
  };
  return (
    <Popup visible={visible && !capturing} onClose={onClose} label="Ask Maalam">
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
      <KeyboardAvoidingView behavior="padding">
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Ask Maalam</Text>
          <Button label="Close" variant="secondary" onPress={onClose} />
        </View>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>Chat, paste a post, or add a public URL to check for AI and harmful content.</Text>
        <ScrollView style={styles.messages} keyboardShouldPersistTaps="handled">
          {messages.map((m, i) => <View key={i} style={[styles.message, { backgroundColor: m.role === 'user' ? theme.buttonSecondary : theme.inputBackground }]}>
            <Text style={{ color: theme.tint, fontWeight: '600', marginBottom: 4 }}>{m.role === 'user' ? 'You' : 'Maalam'}</Text>
            {m.imageUri && <Image source={{ uri: m.imageUri }} style={styles.preview} resizeMode="contain" />}
            <Text selectable style={{ color: theme.text, lineHeight: 21 }}>{m.content}</Text>
          </View>)}
        </ScrollView>
        {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger, marginVertical: 8 }}>{error}</Text>}
        {busy && <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={theme.tint} /><Text style={{ color: theme.textSecondary }}>Checking content…</Text></View>}
        {attachment && <View style={{ marginVertical: 8 }}>
          {attachment.imageUri && <Image source={{ uri: attachment.imageUri }} style={styles.preview} resizeMode="contain" />}
          <Text style={{ color: theme.textSecondary }}>{attachment.imageUri ? 'Screenshot / image attached' : attachment.videoUri ? 'Video attached' : 'Audio attached'}</Text>
          <Button label="Remove attachment" variant="secondary" onPress={() => setAttachment(null)} disabled={busy} />
        </View>}
        <TextInput ref={inputRef} accessibilityLabel="Message or public URL" multiline maxLength={5000} editable={!busy} value={input} onChangeText={setInput} placeholder="Ask a question, paste text or https://…" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBackground }]} />
        <View style={styles.actions}>
          <Button label="Screenshot / image" icon="image-outline" variant="secondary" onPress={() => void attach('image')} disabled={busy} />
          <Button label="Video" icon="videocam-outline" variant="secondary" onPress={() => void attach('video')} disabled={busy} />
          <Button label="Audio" icon="mic-outline" variant="secondary" onPress={() => void attach('audio')} disabled={busy} />
          <Button label="Capture screen" icon="scan-outline" variant="secondary" onPress={() => void attach('screen')} disabled={busy} />
          <Button label="Paste link / text" icon="clipboard-outline" variant="secondary" onPress={() => void pasteLink()} disabled={busy} />
          <Button label="Send" icon="arrow-up" onPress={() => void send()} disabled={busy || (!input.trim() && !attachment)} />
        </View>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>Public links may supply text, an image preview, or a downloadable clip. Private posts need a screenshot or file. {Platform.OS === 'android' ? 'Capture screen opens Android’s chooser, then takes one screenshot after 4 seconds and scans it. Attach a file and press Send to scan it.' : 'Capture screen opens the browser chooser and scans the selected screen. Attach a file and press Send to scan it.'}</Text>
      </KeyboardAvoidingView>
      </ScrollView>
    </Popup>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 140, borderRadius: 8, backgroundColor: '#101820' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 18, marginVertical: 8 },
  messages: { maxHeight: 240 },
  message: { padding: 10, borderRadius: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, maxHeight: 140, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 },
});
