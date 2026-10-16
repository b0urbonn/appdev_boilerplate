import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { VerdictReport } from '@/components/VerdictReport';
import { deleteDetection, getDetection, type Detection } from '@/db/detections';
import { launchApp } from '@/monitor/native';
import { useTheme } from '@/theme';
import { confirmAction } from '@/utils/confirm';

/** Details for one flagged detection; target of maalam://detections/<id>. */
export default function DetectionDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detection, setDetection] = useState<Detection | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDetection(id)
      .then(setDetection)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [id]);

  const remove = () =>
    confirmAction(
      'Delete detection?',
      'This removes the finding and its screenshot from this device.',
      'Delete',
      async () => {
        if (!id) return;
        await deleteDetection(id);
        router.back();
      }
    );

  if (!loaded) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  if (!detection) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>Detection not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
    >
      {detection.screenshotUri && (
        <Image
          source={{ uri: detection.screenshotUri }}
          style={[styles.shot, { borderColor: theme.border }]}
          resizeMode="contain"
        />
      )}

      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
        {detection.appLabel} · {new Date(detection.createdAt).toLocaleString()}
      </Text>

      <VerdictReport
        verdict={detection.verdict}
        confidence={detection.confidence}
        summary={detection.summary}
        findings={detection.findings}
      />

      <Button
        label={`Open ${detection.appLabel}`}
        icon="open-outline"
        variant="secondary"
        onPress={() => void launchApp(detection.packageName)}
      />
      <Button
        label="Delete"
        icon="trash-outline"
        variant="destructiveSecondary"
        onPress={remove}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shot: {
    width: '100%',
    height: 320,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#000',
  },
});
