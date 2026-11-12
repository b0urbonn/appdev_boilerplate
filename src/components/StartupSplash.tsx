import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FlowText as Text } from '@/components/FlowText';
import { useTheme } from '@/theme';

export function StartupSplash() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.logo, { backgroundColor: theme.buttonPrimary }]}>
        <Ionicons name="flash" size={38} color={theme.text} />
      </View>
      <Text style={[styles.name, { color: theme.text }]}>FlowTask</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.8 },
});
