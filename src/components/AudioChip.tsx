// Inline play/pause chip for a voice-message attachment inside a bubble.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useTheme } from '../theme';

const mmss = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function AudioChip({ uri, isUser }: { uri: string; isUser: boolean }) {
  const theme = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const color = isUser ? '#FFFFFF' : theme.textSecondary;

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
      <SmoothPressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={
          status.playing ? 'Pause voice message' : 'Play voice message'
        }
        hitSlop={10}
        style={[styles.button, { backgroundColor: isUser ? '#004A99' : theme.buttonPrimary }]}
      >
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={14}
          color="#FFFFFF"
        />
      </SmoothPressable>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { fontSize: 13, fontVariant: ['tabular-nums'] },
});
