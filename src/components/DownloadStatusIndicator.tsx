import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  cancelDownload,
  downloadModel,
  getModelStatus,
  pauseDownload,
  subscribeModelStatus,
  type ModelStatus,
} from '@/ai/local';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/components/FloatingTabBar';
import { Button, IconButton } from '@/components/Button';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'estimating time';
  if (seconds < 60) return `${Math.max(1, seconds)} sec left`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours} hr ${remainingMinutes} min left`;
  return `${Math.floor(hours / 24)} day ${hours % 24} hr left`;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Persistent in-app controls shown after leaving Detector settings during a download. */
export function DownloadStatusIndicator() {
  const pathname = usePathname();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [status, setStatus] = useState<ModelStatus>(getModelStatus());
  const [error, setError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(pathname !== '/chat');
  const previousPath = useRef(pathname);
  const [dragPosition] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [dragCoordinates, setDragCoordinates] = useState({ x: 0, y: 0 });
  const [pillWidth, setPillWidth] = useState(180);
  const statusProgress =
    status.state === 'downloading' || status.state === 'paused'
      ? status.progress
      : status.state === 'downloaded' || status.state === 'loaded'
        ? 1
        : 0;
  const [animatedProgress] = useState(() => new Animated.Value(statusProgress));

  useEffect(() => subscribeModelStatus(setStatus), []);
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: Math.max(0, Math.min(1, statusProgress)),
      duration: reduceMotion ? 0 : 240,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, statusProgress, reduceMotion]);
  useEffect(() => {
    if (previousPath.current !== pathname) {
      setMinimized(true);
      previousPath.current = pathname;
    }
  }, [pathname]);

  const isDownloading = status.state === 'downloading';
  const progress = statusProgress;
  const isTabScreen = pathname === '/';
  const bottom =
    insets.bottom +
    (isTabScreen ? TAB_BAR_GAP * 2 + TAB_BAR_HEIGHT + 12 : 12) +
    (pathname === '/chat' ? 72 : 0);
  const percent = Math.min(100, Math.round(progress * 100));
  const minX = Math.min(0, 32 + pillWidth - screenWidth);
  const minY = Math.min(0, insets.top + 12 - (screenHeight - bottom - 42));
  const safeBottom = insets.bottom + (isTabScreen ? TAB_BAR_GAP + TAB_BAR_HEIGHT + 8 : 12);
  const maxY = Math.max(0, bottom - safeBottom);
  const panResponder = useMemo(
    () => {
      const moveTo = (dx: number, dy: number) => {
        const next = {
          x: clamp(dragCoordinates.x + dx, minX, 0),
          y: clamp(dragCoordinates.y + dy, minY, maxY),
        };
        dragPosition.setValue(next);
        return next;
      };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {},
        onPanResponderMove: (_event, gesture) => moveTo(gesture.dx, gesture.dy),
        onPanResponderRelease: (_event, gesture) => {
          setDragCoordinates(moveTo(gesture.dx, gesture.dy));
        },
        onPanResponderTerminate: () => {
          dragPosition.setValue(dragCoordinates);
        },
      });
    },
    [dragCoordinates, dragPosition, maxY, minX, minY],
  );

  if (pathname === '/chat-settings' || (status.state !== 'downloading' && status.state !== 'paused')) {
    return null;
  }

  const run = (action: () => Promise<void>) => {
    setError(null);
    action().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  const control = (label: string, action: () => void, destructive = false) => (
    <Button label={label} onPress={action} variant={destructive ? 'destructiveSecondary' : 'secondary'} style={{ flex: 1 }} />
  );

  if (minimized) {
    return (
      <Animated.View
        pointerEvents="box-none"
        style={[styles.position, styles.minimizedPosition, { bottom }]}
      >
        <Animated.View
          {...panResponder.panHandlers}
          onLayout={({ nativeEvent }) => {
            const nextWidth = nativeEvent.layout.width;
            setPillWidth((current) => (Math.abs(current - nextWidth) > 1 ? nextWidth : current));
          }}
          style={[styles.miniDraggable, { transform: dragPosition.getTranslateTransform() }]}
        >
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel={`Expand ${isDownloading ? 'model download' : 'paused download'}, ${percent}% complete`}
            accessibilityHint="Drag to move this indicator, or tap to expand it"
            onPress={() => setMinimized(false)}
            style={[styles.miniPill, { backgroundColor: theme.buttonPrimary, borderColor: theme.buttonPrimary }]}
          >
            <Ionicons
              name={isDownloading ? 'cloud-download-outline' : 'pause-circle-outline'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={[styles.miniLabel, { color: '#FFFFFF' }]}>
              {isDownloading ? 'Downloading' : 'Paused'} {percent}%
            </Text>
            <Ionicons name="chevron-up" size={16} color="#FFFFFF" />
          </SmoothPressable>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.position, { bottom }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.heading}>
          <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }}>
            {isDownloading ? 'Model download' : 'Download paused'}
          </Text>
          <Text style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
            {percent}%
          </Text>
          <IconButton icon="chevron-down" label="Minimize download status" onPress={() => setMinimized(true)} />
        </View>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <Animated.View
            style={[styles.fill, { backgroundColor: theme.tint, width: animatedProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
          />
        </View>
        {isDownloading && (
          <Text style={[styles.details, { color: theme.textSecondary }]}>
            {formatBytes(status.downloadedBytes)} of {formatBytes(status.totalBytes)}  ·  {' '}
            {status.speedBytesPerSecond > 0
              ? `${formatBytes(status.speedBytesPerSecond)}/s`
              : 'measuring speed'}{'  ·  '}
            {formatEta(status.etaSeconds)}
          </Text>
        )}
        <View style={styles.controls}>
          {isDownloading
            ? control('Pause', () => run(pauseDownload))
            : control('Resume', () => run(downloadModel))}
          {control('Cancel', () => run(cancelDownload), true)}
        </View>
        {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 12,
  },
  minimizedPosition: { alignItems: 'flex-end' },
  miniDraggable: { maxWidth: '100%' },
  card: {
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniPill: {
    minHeight: 44,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  miniLabel: { fontSize: 13, fontWeight: '600' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%' },
  details: { fontSize: 12, marginTop: 7 },
  controls: { flexDirection: 'row', gap: 8, marginTop: 9 },
  error: { fontSize: 12, marginTop: 7 },
});
