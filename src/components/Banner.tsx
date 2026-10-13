import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  text: string;
  /** If provided, the banner becomes a tappable link. */
  actionLabel?: string;
  onPress?: () => void;
}

export function Banner({ text, actionLabel, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.container, { backgroundColor: '#B3261E' }]}
    >
      <Text style={styles.text}>
        {text}
        {actionLabel ? `  ${actionLabel}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
});
