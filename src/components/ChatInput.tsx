import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme, type Theme } from '../theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  generating?: boolean;
  /** Local URI of the staged image attachment. */
  imageUri?: string | null;
  /** When given, an attach-image button is shown inside the pill. */
  onPickImage?: () => void;
  onRemoveImage?: () => void;
  /** Staged voice message waiting to be sent. */
  audio?: { uri: string; durationMs: number } | null;
  onRemoveAudio?: () => void;
  /** True while the mic is recording. */
  recording?: boolean;
  /** Elapsed recording time in milliseconds. */
  recordingMs?: number;
  /** When given, a mic button is shown on empty input. */
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onCancelRecording?: () => void;
}

/** Height of one line of the input row (inside the pill border). */
const ROW_H = 42;

const mmss = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  generating,
  imageUri,
  onPickImage,
  onRemoveImage,
  audio,
  onRemoveAudio,
  recording,
  recordingMs,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
}: Props) {
  const theme = useTheme();
  const canSend =
    !disabled &&
    !generating &&
    !recording &&
    (value.trim().length > 0 || !!imageUri || !!audio);
  const dimmed = disabled || generating;
  const showMic =
    !!onStartRecording && value.trim().length === 0 && !audio;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, borderTopColor: theme.border },
      ]}
    >
      {(imageUri || audio) && (
        <View
          style={[
            styles.tray,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.trayHeader}>
            <Ionicons name="attach" size={14} color={theme.tint} />
            <Text
              style={{
                color: theme.textSecondary,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              Attached - will be sent with your message
            </Text>
          </View>
          {imageUri && (
            <View style={styles.trayItem}>
              <Image source={{ uri: imageUri }} style={styles.trayThumb} />
              <View style={styles.flex}>
                <Text
                  style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}
                >
                  Image
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  Ready to send
                </Text>
              </View>
              <Pressable
                onPress={onRemoveImage}
                accessibilityLabel="Remove image"
                hitSlop={8}
                style={[styles.removeBtn, { backgroundColor: theme.border }]}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
            </View>
          )}
          {audio && (
            <AudioPreview
              uri={audio.uri}
              durationMs={audio.durationMs}
              onRemove={onRemoveAudio}
              theme={theme}
            />
          )}
        </View>
      )}
      <View style={styles.inputRow}>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: theme.inputBackground,
              borderColor: theme.border,
            },
          ]}
        >
          {recording ? (
            <View style={styles.recRow}>
              <View style={[styles.recDot, { backgroundColor: theme.danger }]} />
              <Text style={{ color: theme.text, fontSize: 15 }}>
                Recording {mmss(recordingMs ?? 0)}
              </Text>
              <View style={styles.flex} />
              <Pressable
                onPress={onCancelRecording}
                accessibilityLabel="Discard recording"
                hitSlop={8}
                style={styles.iconBtn}
              >
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={theme.danger}
                />
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                // Browsers default a textarea to 2 rows; keep it to one line.
                {...(Platform.OS === 'web' ? ({ rows: 1 } as object) : {})}
                style={[
                  styles.input,
                  { color: theme.text },
                  // RN-web draws a focus outline unless removed.
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
                ]}
                placeholder={
                  disabled
                    ? 'Set up the AI in Chat settings to start'
                    : imageUri || audio
                      ? 'Add a message (optional)...'
                      : 'Message AI...'
                }
                placeholderTextColor={theme.textSecondary}
                value={value}
                onChangeText={onChange}
                multiline
                editable={!disabled}
                textAlignVertical="center"
                onKeyPress={
                  Platform.OS === 'web'
                    ? (e) => {
                        const ne = e.nativeEvent as unknown as {
                          key: string;
                          shiftKey: boolean;
                          preventDefault?: () => void;
                        };
                        if (ne.key === 'Enter' && !ne.shiftKey) {
                          ne.preventDefault?.();
                          if (canSend) onSend();
                        }
                      }
                    : undefined
                }
              />
              {onPickImage && (
                <Pressable
                  onPress={onPickImage}
                  disabled={dimmed}
                  accessibilityLabel="Attach image"
                  hitSlop={4}
                  style={[styles.iconBtn, dimmed && styles.faded]}
                >
                  <Ionicons
                    name="attach"
                    size={26}
                    color={theme.textSecondary}
                  />
                </Pressable>
              )}
              {showMic && (
                <Pressable
                  onPress={onStartRecording}
                  disabled={dimmed}
                  accessibilityLabel="Record voice message"
                  hitSlop={4}
                  style={[styles.iconBtn, dimmed && styles.faded]}
                >
                  <Ionicons
                    name="mic-outline"
                    size={24}
                    color={theme.textSecondary}
                  />
                </Pressable>
              )}
            </>
          )}
        </View>
        {recording ? (
          <Pressable
            onPress={onStopRecording}
            accessibilityLabel="Use recording"
            style={[styles.action, { backgroundColor: theme.tint }]}
          >
            <Ionicons name="checkmark" size={22} color="#FFF" />
          </Pressable>
        ) : generating ? (
          <Pressable
            onPress={onStop}
            accessibilityLabel="Stop generating"
            style={[styles.action, { backgroundColor: theme.danger }]}
          >
            <Ionicons name="stop" size={22} color="#FFF" />
          </Pressable>
        ) : (
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityLabel="Send message"
            style={[
              styles.action,
              { backgroundColor: canSend ? theme.tint : theme.border },
            ]}
          >
            <Ionicons name="arrow-up" size={22} color="#FFF" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Play/pause preview of a staged voice message in the attachment tray. */
function AudioPreview({
  uri,
  durationMs,
  onRemove,
  theme,
}: {
  uri: string;
  durationMs: number;
  onRemove?: () => void;
  theme: Theme;
}) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) void player.seekTo(0);
    player.play();
  };

  // Position while playing; the clip's total length otherwise.
  const shownMs =
    status.currentTime > 0 && !status.didJustFinish
      ? status.currentTime * 1000
      : durationMs;

  return (
    <View style={styles.trayItem}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? 'Pause preview' : 'Play preview'
        }
        hitSlop={6}
        style={[styles.audioPlay, { backgroundColor: theme.tint }]}
      >
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={20}
          color="#FFF"
        />
      </Pressable>
      <View style={styles.flex}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
          Voice message
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          {mmss(shownMs)}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityLabel="Remove voice message"
        hitSlop={8}
        style={[styles.removeBtn, { backgroundColor: theme.border }]}
      >
        <Ionicons name="close" size={18} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tray: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  trayHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trayItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trayThumb: { width: 72, height: 72, borderRadius: 12 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flex: 1,
    minHeight: ROW_H + 2,
    borderRadius: (ROW_H + 2) / 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  recRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: ROW_H,
    paddingHorizontal: 10,
  },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
  action: {
    width: ROW_H + 2,
    height: ROW_H + 2,
    borderRadius: (ROW_H + 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faded: { opacity: 0.4 },
});
