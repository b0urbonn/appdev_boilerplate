import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalDevice } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';
import { IconButton } from './Button';

export function LocalHardwareStatus({ loaded = false }: { loaded?: boolean }) {
  const theme = useTheme();
  const { localDevice, refreshLocalDevice } = useLocalDevice();
  if (localDevice.state === 'idle' || localDevice.state === 'checking') {
    return <View style={styles.row} accessibilityLiveRegion="polite"><ActivityIndicator color={theme.tint} /><Text style={{ color: theme.textSecondary }}>Checking hardware…</Text></View>;
  }
  if (localDevice.state === 'error') {
    return <View style={styles.row}><Text style={[styles.flex, { color: theme.textSecondary }]}>{localDevice.message}</Text><IconButton icon="refresh-outline" label="Retry hardware check" onPress={refreshLocalDevice} /></View>;
  }
  const report = localDevice.report;
  const ready = report.compatible && (loaded || report.memoryReady) && report.storageReady;
  const chip = report.soc.toUpperCase().startsWith('SM8550') ? 'Snapdragon 8 Gen 2' : report.soc || report.model;
  const issue = !report.compatible ? 'ARM64 Android required'
    : !report.storageReady ? 'More storage needed'
    : loaded ? 'Device compatible'
    : !report.memoryReady ? 'More total RAM required'
    : `${report.recommendedBackend.toUpperCase()} preferred`;
  return (
    <View style={[styles.panel, { borderColor: theme.border }]}>
      <View style={styles.row}>
        <Ionicons name="hardware-chip-outline" size={22} color={theme.tint} accessible={false} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: theme.text }]}>{report.npuDetected ? 'NPU detected' : 'Device compatibility'}</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>{chip}</Text>
        </View>
        <IconButton icon="refresh-outline" label="Refresh device resources" onPress={refreshLocalDevice} loading={localDevice.refreshing} />
      </View>
      <Text style={[styles.detail, { color: theme.textSecondary }]}>
        {Math.round(report.totalRamBytes / 1e9)} GB RAM · {(report.availableRamBytes / 1e9).toFixed(1)} GB available · {(report.freeStorageBytes / 1e9).toFixed(0)} GB storage free
      </Text>
      {localDevice.refreshError && <Text style={[styles.detail, { color: theme.danger }]}>Refresh failed. Try again.</Text>}
      <View style={styles.row}>
        <Ionicons name={ready ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={16} color={ready ? theme.success : theme.danger} accessible={false} />
        <Text style={[styles.detail, { color: ready ? theme.textSecondary : theme.danger }]}>{issue}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8, paddingBottom: 14, marginBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13, lineHeight: 19 },
});
