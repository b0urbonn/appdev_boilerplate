import { Button } from './Button';
import { Popup } from './Popup';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import Svg, { Circle } from 'react-native-svg';
import type { ContextUsage } from '@/ai/types';
import type { Theme } from '@/theme';

/** Turns orange above this fraction of the context window. */
const WARN_AT = 0.5;
/** Turns red above this fraction of the context window. */
const DANGER_AT = 0.8;

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function Ring({
  size,
  stroke,
  fraction,
  color,
  track,
  children,
}: {
  size: number;
  stroke: number;
  fraction: number;
  color: string;
  track: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {fraction > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - fraction)}
            // Start the arc at 12 o'clock.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

/**
 * Circular context-window meter: how much of the AI's memory the chat fills.
 * Tap it for details.
 */
export function ContextRing({
  usage,
  theme,
}: {
  usage: ContextUsage;
  theme: Theme;
}) {
  const [open, setOpen] = useState(false);
  const { usedTokens, maxTokens, estimated } = usage;
  const fraction = maxTokens ? Math.min(usedTokens / maxTokens, 1) : 0;
  const color =
    fraction >= DANGER_AT
      ? theme.danger
      : fraction >= WARN_AT
        ? theme.warning
        : theme.success;
  const percent = maxTokens ? `${Math.round(fraction * 100)}%` : '?';

  return (
    <>
      <SmoothPressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Context window ${percent} used`}
        hitSlop={8}
        style={[styles.contextButton, { backgroundColor: theme.buttonSecondary }]}
      >
        <Ring size={34} stroke={4} fraction={fraction} color={color} track={theme.border}>
          <Text style={[styles.small, { color: theme.text }]}>{percent}</Text>
        </Ring>
      </SmoothPressable>

      <Popup visible={open} onClose={() => setOpen(false)} label="AI memory" style={styles.sheet}>
            <Text style={[styles.title, { color: theme.text }]}>AI memory (context window)</Text>
            <Ring size={140} stroke={12} fraction={fraction} color={color} track={theme.border}>
              <Text style={[styles.big, { color: theme.text }]}>{percent}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>used</Text>
            </Ring>

            <Text style={[styles.line, { color: theme.text }]}>
              {estimated ? 'About ' : ''}
              {fmt(usedTokens)}
              {maxTokens ? ` of ${fmt(maxTokens)}` : ''} tokens used
            </Text>
            {maxTokens ? (
              <Text style={[styles.line, { color: theme.textSecondary }]}>
                Room left: {fmt(Math.max(maxTokens - usedTokens, 0))} tokens
              </Text>
            ) : (
              <Text style={[styles.line, { color: theme.textSecondary }]}>
                The memory size shows after the first AI reply.
              </Text>
            )}
            {fraction >= DANGER_AT && (
              <Text style={[styles.line, { color: theme.danger }]}>
                Almost full - older messages will be forgotten. Tap the trash icon to clear the
                chat and reset the AI memory.
              </Text>
            )}
            {fraction >= WARN_AT && fraction < DANGER_AT && (
              <Text style={[styles.line, { color: theme.warning }]}>
                Memory is filling up.
              </Text>
            )}
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {estimated
                ? 'Estimated at ~4 characters per token until the AI reports real numbers.'
                : 'Reported by the AI after its last reply.'}
            </Text>
            <Button label="Done" variant="secondary" onPress={() => setOpen(false)} style={{ alignSelf: 'stretch', marginTop: 8 }} />
      </Popup>
    </>
  );
}

const styles = StyleSheet.create({
  contextButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  small: { fontSize: 11, fontWeight: '700' },
  big: { fontSize: 28, fontWeight: '700' },
  sheet: { borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  line: { fontSize: 14, textAlign: 'center' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
