import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Theme } from '@/theme';

/** A titled card used to group rows on settings screens. */
export function Section({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: Theme;
}) {
  return (
    <View style={[styles.section, { backgroundColor: theme.card }]}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 12, padding: 14, marginBottom: 14 },
  title: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
});
