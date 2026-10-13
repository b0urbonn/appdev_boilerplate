import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MessageRow } from '../db/messages';
import { useTheme } from '../theme';
import { AudioChip } from './AudioChip';
import { MarkdownText } from './MarkdownText';
import { TypingDots } from './TypingDots';

interface Props {
  message: MessageRow;
  /** Label shown while a pending message has no content yet. */
  pendingLabel?: string;
  onRetry?: (message: MessageRow) => void;
}

export function MessageBubble({ message, pendingLabel, onRetry }: Props) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const retryable = message.status === 'error' && !!onRetry;
  const showPendingDots =
    message.status === 'pending' && message.content === '';

  return (
    <View
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAssistant,
      ]}
    >
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
          <Ionicons name="sparkles" size={14} color="#FFF" />
        </View>
      )}
      <View style={[styles.bubbleCol, isUser && styles.colUser]}>
        <Pressable
          disabled={!retryable}
          onPress={() => onRetry?.(message)}
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
            {
              backgroundColor: isUser
                ? theme.userBubble
                : theme.assistantBubble,
              borderColor: theme.danger,
              borderWidth: message.status === 'error' ? 1 : 0,
            },
          ]}
        >
          {message.image_uri && (
            <Image
              source={{ uri: message.image_uri }}
              style={[
                styles.image,
                (message.audio_uri || message.content.length > 0) && {
                  marginBottom: 6,
                },
              ]}
              resizeMode="cover"
            />
          )}
          {message.audio_uri && (
            <View style={message.content.length > 0 && { marginBottom: 6 }}>
              <AudioChip uri={message.audio_uri} isUser={isUser} />
            </View>
          )}
          {isUser ? (
            message.content.length > 0 && (
              <Text style={{ color: theme.userBubbleText, fontSize: 16 }}>
                {message.content}
              </Text>
            )
          ) : (
            message.content.length > 0 && (
              <MarkdownText
                text={message.content}
                color={theme.text}
                theme={theme}
              />
            )
          )}
          {showPendingDots && (
            <View style={styles.pendingRow}>
              <TypingDots color={theme.textSecondary} />
              {pendingLabel && pendingLabel !== 'Generating...' && (
                <Text
                  style={{ color: theme.textSecondary, fontStyle: 'italic' }}
                >
                  {pendingLabel}
                </Text>
              )}
            </View>
          )}
          {message.status === 'error' && (
            <View style={styles.errorBlock}>
              <View style={styles.errorRow}>
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={theme.danger}
                />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {message.error ?? 'Failed to generate.'}
                </Text>
              </View>
              {retryable && (
                <View style={styles.errorRow}>
                  <Ionicons name="refresh" size={14} color={theme.tint} />
                  <Text style={[styles.errorText, { color: theme.tint }]}>
                    Retry
                  </Text>
                </View>
              )}
            </View>
          )}
        </Pressable>
        {message.status !== 'pending' && (
          <Text style={[styles.time, { color: theme.textSecondary }]}>
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 6, paddingHorizontal: 12 },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bubbleCol: { maxWidth: '82%' },
  colUser: { alignItems: 'flex-end' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderTopLeftRadius: 4 },
  image: { width: 200, height: 200, borderRadius: 12 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBlock: { marginTop: 6, gap: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorText: { fontSize: 13, flexShrink: 1 },
  time: { fontSize: 11, marginTop: 4, marginHorizontal: 4 },
});
