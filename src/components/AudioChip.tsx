// Inline play/pause chip for a voice-message attachment inside a bubble.
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

const mmss = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function AudioChip({ uri, isUser }: { uri: string; isUser: boolean }) {
  const theme = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const color = isUser ? '#FFF' : theme.text;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish) void player.seekTo(0);
    player.play();
  };

  // While playing show the position; otherwise the clip's total length.
  const shown =
    status.currentTime > 0 && !status.didJustFinish
      ? status.currentTime
      : status.duration;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? 'Pause voice message' : 'Play voice message'
        }
        hitSlop={6}
        style={[styles.button, { borderColor: color }]}
      >
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={14}
          color={color}
        />
      </Pressable>
      <Text style={[styles.time, { color }]}>{mmss(shown)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { fontSize: 13, fontVariant: ['tabular-nums'] },
});
