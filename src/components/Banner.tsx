import { useTheme } from '@/theme';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';

interface Props {
  text: string;
  /** If provided, the banner becomes a tappable link. */
  actionLabel?: string;
  onPress?: () => void;
}

export function Banner({ text, actionLabel, onPress }: Props) {
  const theme = useTheme();
  return (
    <SmoothPressable
      onPress={onPress}
      accessible={!!onPress}
      accessibilityRole={onPress ? 'button' : 'none'}
      disabled={!onPress}
      style={[styles.container, { backgroundColor: theme.card }]}
    >
      <Text style={[styles.text, { color: theme.danger }]}>
        {text}
        {actionLabel ? `  ${actionLabel}` : ''}
      </Text>
    </SmoothPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
});
