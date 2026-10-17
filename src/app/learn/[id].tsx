import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { LessonIllustration } from '@/components/learn/LessonIllustration';
import { LESSONS } from '@/learn/lessons';
import { useTheme } from '@/theme';

/** One lesson from src/learn/lessons.ts. */
export default function LessonScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const index = LESSONS.findIndex((l) => l.id === id);
  const lesson = index >= 0 ? LESSONS[index] : null;
  const next = index >= 0 ? LESSONS[index + 1] : null;

  if (!lesson) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>Lesson not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
    >
      <Stack.Screen options={{ title: lesson.title }} />
      <LessonIllustration id={lesson.id} title={lesson.title} />
      <Text style={[styles.readTime, { color: theme.textSecondary }]}>
        {lesson.readMinutes} min read
      </Text>
      {lesson.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={[styles.heading, { color: theme.text }]}>{section.heading}</Text>
          {section.bullets.map((bullet, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={{ color: theme.tint, fontSize: 15 }}>•</Text>
              <Text style={[styles.bullet, { color: theme.textSecondary }]}>{bullet}</Text>
            </View>
          ))}
        </View>
      ))}
      {next && (
        <Button
          label={`Next lesson: ${next.title}`}
          icon="arrow-forward-outline"
          onPress={() => router.push(`/learn/${next.id}` as Href)}
          style={{ marginTop: 12 }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 4, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  readTime: { fontSize: 13, textAlign: 'left', marginTop: 0, marginBottom: 4 },
  section: { marginTop: 12, gap: 6 },
  heading: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bullet: { flex: 1, fontSize: 14, lineHeight: 21 },
});
