import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { IconButton } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
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
  /** When given, an attach-image button is shown beside the input. */
  onPickImage?: () => void;
  onRemoveImage?: () => void;
  /** Staged voice message waiting to be sent. */
  audio?: { uri: string; durationMs: number } | null;
  onRemoveAudio?: () => void;
  /** True while the mic is recording. */
  recording?: boolean;
  /** Elapsed recording time in milliseconds. */
  recordingMs?: number;
  /** When given, a mic button is shown beside the input. */
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onCancelRecording?: () => void;
}

/** Height of one line of the input row (inside the pill border). */
const ROW_H = 46;

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
    !!onStartRecording && !audio;

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
              Ready to send
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
              <SmoothPressable
                onPress={onRemoveImage}
                accessibilityLabel="Remove image"
                hitSlop={8}
                style={[styles.removeBtn, { backgroundColor: theme.buttonDanger }]}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </SmoothPressable>
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
        {!recording && onPickImage && <IconButton icon="attach-outline" label="Attach image" onPress={onPickImage} disabled={dimmed} style={styles.toolButton} />}

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
              <View style={[styles.recDot, { backgroundColor: theme.buttonDanger }]} />
              <Text style={{ color: theme.text, fontSize: 15 }}>
                {mmss(recordingMs ?? 0)}
              </Text>
              <View style={styles.flex} />
              <SmoothPressable
                onPress={onCancelRecording}
                accessibilityLabel="Discard recording"
                hitSlop={8}
                style={[styles.iconBtn, { backgroundColor: theme.buttonDanger }]}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              </SmoothPressable>
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
                accessibilityLabel="Message"
                placeholder={
                  disabled
                    ? 'Message…'
                    : imageUri || audio
                      ? 'Add a message…'
                      : 'Message…'
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
            </>
          )}
        </View>
        {!recording && showMic && <IconButton icon="mic-outline" label="Record voice message" onPress={onStartRecording} disabled={dimmed} style={styles.toolButton} />}
        {recording ? (
          <SmoothPressable
            onPress={onStopRecording}
            accessibilityLabel="Use recording"
            style={[styles.action, { backgroundColor: theme.buttonPrimary }]}
          >
            <Ionicons name="checkmark" size={22} color="#FFF" />
          </SmoothPressable>
        ) : generating ? (
          <SmoothPressable
            onPress={onStop}
            accessibilityLabel="Stop generating"
            style={[styles.action, { backgroundColor: theme.buttonDanger }]}
          >
            <Ionicons name="stop" size={22} color="#FFF" />
          </SmoothPressable>
        ) : (
          <SmoothPressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityLabel="Send message"
            style={[
              styles.action,
              { backgroundColor: canSend ? theme.buttonPrimary : theme.buttonSecondary },
            ]}
          >
            <Ionicons name="arrow-up" size={22} color={canSend ? '#FFFFFF' : theme.textSecondary} />
          </SmoothPressable>
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
      <SmoothPressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? 'Pause preview' : 'Play preview'
        }
        hitSlop={6}
        style={[styles.audioPlay, { backgroundColor: theme.buttonPrimary }]}
      >
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={20}
          color="#FFF"
        />
      </SmoothPressable>
      <View style={styles.flex}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
          Voice message
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          {mmss(shownMs)}
        </Text>
      </View>
      <SmoothPressable
        onPress={onRemove}
        accessibilityLabel="Remove voice message"
        hitSlop={8}
        style={[styles.removeBtn, { backgroundColor: theme.buttonDanger }]}
      >
        <Ionicons name="close" size={18} color="#FFFFFF" />
      </SmoothPressable>
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
  toolButton: { height: ROW_H + 2, flexShrink: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  pill: {
    flex: 1,
    minHeight: ROW_H + 2,
    minWidth: 0,
    borderRadius: (ROW_H + 2) / 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    flexShrink: 0,
    borderRadius: (ROW_H + 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faded: { opacity: 0.4 },
});
