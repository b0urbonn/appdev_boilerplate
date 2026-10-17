import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import { LESSONS } from '@/learn/lessons';
import { useTheme } from '@/theme';

/** Offline deepfake-safety lessons. */
export default function LearnScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
    >
      <Text style={[styles.title, { color: theme.text }]}>Learn</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Short, practical guides to spotting deepfakes and scams.
      </Text>
      {LESSONS.map((lesson) => (
        <SmoothPressable
          key={lesson.id}
          accessibilityRole="button"
          accessibilityLabel={`${lesson.title}, ${lesson.readMinutes} minute read`}
          onPress={() => router.push(`/learn/${lesson.id}` as Href)}
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.buttonSecondary }]}>
            <Ionicons name={lesson.icon} size={24} color={theme.tint} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{lesson.title}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={2}>
              {lesson.summary}
            </Text>
            <Text style={{ color: theme.tint, fontSize: 12, fontWeight: '600', marginTop: 4 }}>
              {lesson.readMinutes} min read
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </SmoothPressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 10 },
  flex: { flex: 1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: 8 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: -4, marginBottom: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '600' },
});
