import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { authenticateWithDevice } from '@/security/deviceAuthentication';
import { useTheme } from '@/theme';

interface AppLockScreenProps {
  onUnlock: () => void;
  nickname?: string;
}

export function AppLockScreen({ onUnlock, nickname }: AppLockScreenProps) {
  const theme = useTheme();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticating = useRef(false);

  const handleUnlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    setVerifying(true);
    setError(null);

    try {
      if (Platform.OS !== 'android') {
        setError('App lock is available on Android only.');
        return;
      }

      const result = await authenticateWithDevice();

      if (result.success) {
        onUnlock();
      } else if (result.error === 'not_enrolled') {
        setError('Set up a screen lock on your phone, then try again.');
      } else if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        setError('Unlock was cancelled. Tap below to try again.');
      } else if (result.error === 'lockout') {
        setError('Too many attempts. Try again or use your device screen lock.');
      } else {
        setError('Could not verify your identity. Try again.');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open device authentication. Check your screen lock and try again.');
    } finally {
      authenticating.current = false;
      setVerifying(false);
    }
  }, [onUnlock]);

  // Ask for authentication as soon as the lock screen appears. The button
  // remains available if the system prompt is cancelled or needs a retry.
  useEffect(() => {
    const timer = setTimeout(() => void handleUnlock(), 0);
    return () => clearTimeout(timer);
  }, [handleUnlock]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={[styles.avatarCircle, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="lock-closed" size={38} color={theme.buttonPrimary} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>
          {nickname ? `Welcome back, ${nickname}` : 'Maalam is Locked'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Unlock with your phone’s face or fingerprint recognition, or its PIN, pattern, or password.
        </Text>

        {error && (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {error}
          </Text>
        )}

        <View style={styles.actionContainer}>
          <Button
            label={verifying ? 'Checking…' : 'Try again'}
            icon="scan-outline"
            onPress={() => void handleUnlock()}
            disabled={verifying}
            loading={verifying}
            style={styles.primaryButton}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark-outline" size={16} color={theme.textSecondary} />
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          Authentication is checked by Android
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  actionContainer: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
