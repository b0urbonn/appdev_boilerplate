import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AudioChip } from '@/components/AudioChip';
import { Button } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { VerdictReport } from '@/components/VerdictReport';
import { deleteScan, getScan, type Scan } from '@/db/scans';
import { useTheme } from '@/theme';
import { confirmAction } from '@/utils/confirm';

/** Result page for a manual scan, reached after "Scan now". */
export default function ScanResultScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [textExpanded, setTextExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    getScan(id)
      .then(setScan)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [id]);

  const remove = () =>
    confirmAction(
      'Delete scan?',
      'This removes the result and any attached media from this device.',
      'Delete',
      async () => {
        if (!id) return;
        await deleteScan(id);
        router.back();
      }
    );

  if (!loaded) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  if (!scan) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>Scan not found.</Text>
      </View>
    );
  }

  const longText = (scan.text ?? '').split('\n').length > 8 || (scan.text ?? '').length > 500;
  const providerLabel = scan.provider === 'local' ? 'Local AI' : scan.provider === 'cloud' ? 'Gemini' : scan.provider;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
    >
      {scan.kind === 'image' && scan.mediaUri && (
        <Image
          source={{ uri: scan.mediaUri }}
          style={[styles.shot, { borderColor: theme.border }]}
          resizeMode="contain"
        />
      )}
      {scan.kind === 'video' && (
        <View style={[styles.mediaCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="videocam-outline" size={40} color={theme.tint} />
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Video clip</Text>
        </View>
      )}
      {scan.kind === 'audio' && scan.mediaUri && (
        <View style={[styles.mediaCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <AudioChip uri={scan.mediaUri} isUser={false} />
        </View>
      )}
      {scan.kind === 'text' && (
        <View style={[styles.textCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text
            style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}
            numberOfLines={textExpanded ? undefined : 8}
          >
            {scan.text}
          </Text>
          {longText && (
            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel={textExpanded ? 'Show less' : 'Show more'}
              onPress={() => setTextExpanded(!textExpanded)}
              hitSlop={8}
            >
              <Text style={{ color: theme.tint, fontSize: 13, fontWeight: '600' }}>
                {textExpanded ? 'Show less' : 'Show more'}
              </Text>
            </SmoothPressable>
          )}
        </View>
      )}

      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
        {new Date(scan.createdAt).toLocaleString()}
        {providerLabel ? ` · ${providerLabel}` : ''}
      </Text>

      <VerdictReport
        verdict={scan.verdict}
        confidence={scan.confidence}
        summary={scan.summary}
        findings={scan.findings}
      />

      <Button
        label="Scan something else"
        icon="scan-outline"
        onPress={() => router.push('/(tabs)/scan' as Href)}
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
  mediaCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  textCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
});
