import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import {
  copyIntoScans,
  pickAudioFile,
  pickImage,
  pickVideo,
} from '@/attachments/files';
import { cropFindingRegions, deleteFindingCrops } from '@/attachments/regionCrops';
import { AudioChip } from '@/components/AudioChip';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { Button } from '@/components/Button';
import {
  LiveScanPickerModal,
  type SelectedLiveTarget,
} from '@/components/LiveScanPickerModal';
import { SmoothPressable } from '@/components/SmoothPressable';
import { analyzeContent, type ScanInput } from '@/detection/analyze';
import { newId } from '@/db/client';
import { insertScan } from '@/db/scans';
import { useAiStatus } from '@/hooks/useAiStatus';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useMonitorService } from '@/monitor/useMonitorService';
import {
  isMonitorServiceEnabled,
  launchApp,
  openAccessibilitySettings,
  requestScreenShare,
  stopScreenShare,
} from '@/monitor/native';
import { EASE_OUT, SPRING, enter, fadeIn } from '@/motion';
import { useSettings } from '@/settings/SettingsContext';
import { showMessage } from '@/utils/confirm';
import { useTheme } from '@/theme';
import { typography } from '@/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Kind = ScanInput['kind'];
type ScanTab = 'live' | Kind;

interface StagedItem {
  kind: Kind;
  uri?: string;
  text?: string;
  name?: string;
  size?: number;
}

const TABS: { kind: ScanTab; icon: IconName; activeIcon: IconName; label: string; badgeLabel: string }[] = [
  { kind: 'live', icon: 'radio-outline', activeIcon: 'radio', label: 'Live', badgeLabel: 'Live Call' },
  { kind: 'image', icon: 'image-outline', activeIcon: 'image', label: 'Image', badgeLabel: 'Photo' },
  { kind: 'video', icon: 'videocam-outline', activeIcon: 'videocam', label: 'Video', badgeLabel: 'Video' },
  { kind: 'audio', icon: 'mic-outline', activeIcon: 'mic', label: 'Audio', badgeLabel: 'Voice' },
  { kind: 'text', icon: 'document-text-outline', activeIcon: 'document-text', label: 'Text', badgeLabel: 'Message' },
];

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ attach?: string }>();
  const handledAttachment = useRef<string | null>(null);
  const { settings, update } = useSettings();
  const { problem } = useAiStatus();
  const recorder = useVoiceRecorder();
  const monitorStatus = useMonitorService();

  const [selected, setSelected] = useState<ScanTab>('live');
  const [segmentWidth, setSegmentWidth] = useState(0);
  const reduceMotion = useReduceMotion();
  const indicatorPosition = useSharedValue(0);
  const stageProgress = useSharedValue(1);
  const selectedIndex = TABS.findIndex((tab) => tab.kind === selected);
  const [selectedLiveTarget, setSelectedLiveTarget] = useState<SelectedLiveTarget | null>(null);
  const [selectedLiveScreen, setSelectedLiveScreen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [stagedMap, setStagedMap] = useState<Partial<Record<Kind, StagedItem>>>({});
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const position = selectedIndex * segmentWidth;
    indicatorPosition.set(reduceMotion ? position : withSpring(position, { ...SPRING, overshootClamping: true }));
  }, [selectedIndex, segmentWidth, reduceMotion, indicatorPosition]);

  useEffect(() => {
    if (reduceMotion) {
      stageProgress.set(1);
      return;
    }
    stageProgress.set(0);
    stageProgress.set(withTiming(1, { duration: 220, easing: EASE_OUT }));
  }, [selected, reduceMotion, stageProgress]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicatorPosition.get() }] }));
  const stageStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + stageProgress.get() * 0.5,
    transform: [{ translateY: (1 - stageProgress.get()) * 7 }],
  }));

  const isLocal = settings.provider === 'local';
  const busy = running || recorder.recording;

  const currentStaged = selected === 'live' ? undefined : stagedMap[selected];
  const hasContent =
    selected === 'live'
      ? !!selectedLiveTarget || selectedLiveScreen
      : selected === 'text'
      ? !!currentStaged?.text?.trim()
      : !!currentStaged?.uri;
  const isVideoRestricted = selected === 'video' && isLocal;
  const canRun = selected === 'live' ? true : hasContent && !problem && !isVideoRestricted;

  const removeStaged = (kind: Kind) => {
    setStagedMap((prev) => {
      const next = { ...prev };
      delete next[kind];
      return next;
    });
  };

  const pick = async (kind: Kind) => {
    try {
    if (kind === 'image') {
      const uri = await pickImage();
      if (uri) {
        setStagedMap((prev) => ({
          ...prev,
          image: { kind: 'image', uri, name: uri.split('/').pop() ?? 'Photo' },
        }));
      }
    } else if (kind === 'video') {
      const v = await pickVideo();
      if (v) {
        setStagedMap((prev) => ({
          ...prev,
          video: { kind: 'video', uri: v.uri, name: v.name, size: v.size },
        }));
      }
    } else if (kind === 'audio') {
      const a = await pickAudioFile();
      if (a) {
        setStagedMap((prev) => ({
          ...prev,
          audio: { kind: 'audio', uri: a.uri, name: a.name, size: a.size },
        }));
      }
    }
    } catch (error) {
      showMessage('Attachment', error instanceof Error ? error.message : 'Could not attach this file.');
    }
  };

  useEffect(() => {
    const kind = routeParams.attach;
    if (!kind) { handledAttachment.current = null; return; }
    if (handledAttachment.current === kind || !['image', 'video', 'audio', 'text'].includes(kind)) return;
    setSelected(kind as Kind);
    // Open the real system picker only after the Scan route has mounted.
    const timer = setTimeout(() => {
      handledAttachment.current = kind;
      router.setParams({ attach: undefined });
      if (kind !== 'text') void pick(kind as Kind);
    }, 250);
    return () => clearTimeout(timer);
    // The picker must run once for this deep link, not after every staged change.
  }, [routeParams.attach, router]);

  const record = async () => {
    if (recorder.recording) {
      const r = await recorder.stop().catch(() => null);
      if (r?.uri) {
        setStagedMap((prev) => ({
          ...prev,
          audio: { kind: 'audio', uri: r.uri, name: 'Voice recording' },
        }));
      }
      return;
    }
    try {
      await recorder.start();
    } catch (e) {
      showMessage('Microphone', e instanceof Error ? e.message : 'Recording failed.');
    }
  };

  const handleLaunchLiveScan = async (app: SelectedLiveTarget) => {
    if (Platform.OS === 'web') {
      router.push({
        pathname: '/monitor-preview',
        params: { app: app.label, autoScan: 'true' },
      } as Href);
      return;
    }

    const enabled = isMonitorServiceEnabled();
    if (!enabled) {
      Alert.alert(
        'Accessibility Permission Needed',
        `To detect deepfakes during live video calls in ${app.label}, Maalam needs Accessibility permission to observe screen frames.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: openAccessibilitySettings },
        ]
      );
      return;
    }

    const exists = settings.monitoredApps.some((a) => a.packageName === app.packageName);
    if (!exists) {
      const updated = [...settings.monitoredApps, { packageName: app.packageName, label: app.label }];
      await update('monitoredApps', updated);
    }
    if (!settings.monitoringEnabled) {
      await update('monitoringEnabled', true);
    }

    const launched = await launchApp(app.packageName);
    if (!launched) {
      showMessage('Launch Failed', `Could not open ${app.label}. Ensure it is installed on your device.`);
    }
  };

  const handleSelectApp = (app: SelectedLiveTarget) => {
    setPickerVisible(false);
    setSelectedLiveTarget(app);
    setSelectedLiveScreen(false);
  };

  const handleSelectScreen = () => {
    setPickerVisible(false);
    setSelectedLiveTarget(null);
    setSelectedLiveScreen(true);
  };

  const startLiveScreenScan = async () => {
    if (Platform.OS === 'web') {
      router.push({
        pathname: '/monitor-preview',
        params: { app: 'Live Video Call Stream', autoScan: 'true' },
      } as Href);
      return;
    }

    try {
      await requestScreenShare();
    } catch (error) {
      showMessage('Could not start screen share', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const run = async () => {
    if (selected === 'live') {
      if (selectedLiveScreen) {
        if (monitorStatus.sharing) stopScreenShare();
        else void startLiveScreenScan();
      } else if (selectedLiveTarget) {
        void handleLaunchLiveScan(selectedLiveTarget);
      } else {
        setPickerVisible(true);
      }
      return;
    }

    const staged = stagedMap[selected];
    if (!staged || running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    let croppedFindings: Awaited<ReturnType<typeof cropFindingRegions>> = [];
    let persisted = false;
    try {
      const result = await analyzeContent(
        { kind: staged.kind, uri: staged.uri, text: staged.text },
        settings,
        controller.signal
      );
      const id = newId();
      const mediaUri = staged.uri ? await copyIntoScans(staged.uri, id) : null;
      croppedFindings = staged.kind === 'image' ? await cropFindingRegions(mediaUri ?? undefined, result.findings) : result.findings;
      await insertScan({
        id,
        kind: staged.kind,
        mediaUri,
        text: staged.kind === 'text' ? staged.text ?? '' : null,
        verdict: result.verdict,
        confidence: result.confidence,
        summary: result.summary,
        findings: croppedFindings,
        provider: settings.provider,
        createdAt: Date.now(),
      });
      persisted = true;
      removeStaged(selected);
      router.push(`/scans/${id}` as Href);
    } catch (e) {
      if (!controller.signal.aborted) {
        showMessage('Scan failed', e instanceof Error ? e.message : 'Please try again.');
      }
    } finally {
      if (!persisted) await deleteFindingCrops(croppedFindings);
      setRunning(false);
      abortRef.current = null;
    }
  };

  const activeTabMeta = TABS.find((t) => t.kind === selected) ?? TABS[0];
  const providerLabel = isLocal ? 'Gemma (Offline)' : 'Gemini Cloud';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header section with Apple Large Title and Engine Pill */}
      <Animated.View entering={enter(0)} style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: theme.text }]}>Scan</Text>
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel={`AI engine: ${providerLabel}. Tap to change settings.`}
            onPress={() => router.push('/chat-settings' as Href)}
            style={[
              styles.enginePill,
              {
                backgroundColor: theme.buttonSecondary,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons
              name={isLocal ? 'shield-checkmark' : 'sparkles'}
              size={13}
              color={isLocal ? theme.success : theme.tint}
            />
            <Text
              style={[
                styles.enginePillText,
                { color: isLocal ? theme.success : theme.tint },
              ]}
            >
              {isLocal ? 'On-Device' : 'Gemini'}
            </Text>
          </SmoothPressable>
        </View>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Inspect media or live video calls for deepfakes, AI generation, and defects.
        </Text>
      </Animated.View>

      {/* Warning Card if AI provider is not ready */}
      {problem && (
        <Animated.View
          entering={fadeIn()}
          style={[styles.warnCard, { backgroundColor: theme.card, borderColor: theme.warning }]}
        >
          <Ionicons name="alert-circle-outline" size={22} color={theme.warning} />
          <Text style={[styles.flex, { color: theme.text, fontSize: 13, lineHeight: 18 }]}>
            {problem}
          </Text>
          <Button
            label="Configure"
            variant="secondary"
            onPress={() => router.push('/chat-settings' as Href)}
            style={styles.compactBtn}
          />
        </Animated.View>
      )}

      {/* iOS Segmented Control */}
      <Animated.View entering={enter(1)}>
        <View
          accessibilityRole="tablist"
          onLayout={({ nativeEvent }) => setSegmentWidth(Math.max(0, (nativeEvent.layout.width - 6 - StyleSheet.hairlineWidth * 2) / TABS.length))}
          style={[styles.segmentedControl, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          {segmentWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              accessible={false}
              style={[
                styles.selectionIndicator,
                { width: segmentWidth, backgroundColor: theme.background, borderColor: theme.border },
                indicatorStyle,
              ]}
            />
          )}
          {TABS.map((tab) => {
            const active = selected === tab.kind;
            const hasItem =
              tab.kind === 'live'
                ? !!selectedLiveTarget || selectedLiveScreen
                : tab.kind === 'text'
                ? !!stagedMap.text?.text?.trim()
                : !!stagedMap[tab.kind]?.uri;

            return (
              <SmoothPressable
                key={tab.kind}
                accessibilityRole="tab"
                accessibilityLabel={`${tab.label} scan${hasItem ? ', item ready' : ''}`}
                accessibilityState={{ selected: active }}
                disabled={busy}
                onPress={() => setSelected(tab.kind)}
                style={styles.segment}
              >
                <Ionicons
                  name={active ? tab.activeIcon : tab.icon}
                  size={15}
                  color={
                    tab.kind === 'live' && active
                      ? theme.danger
                      : active
                      ? theme.tint
                      : theme.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color:
                        tab.kind === 'live' && active
                          ? theme.danger
                          : active
                          ? theme.text
                          : theme.textSecondary,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.kind === 'live' && monitorStatus.connected && (
                  <View style={[styles.segmentDot, { backgroundColor: theme.success }]} />
                )}
                {hasItem && !active && tab.kind !== 'live' && (
                  <View style={[styles.segmentDot, { backgroundColor: theme.tint }]} />
                )}
              </SmoothPressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Stage Container - Purpose built for each medium */}
      <Animated.View style={[styles.stageContainer, stageStyle]}>
        {/* LIVE SCAN TAB */}
        {selected === 'live' && (
          <View style={[styles.card, styles.liveCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.liveIntroRow}>
              <View style={[styles.liveIconTile, { backgroundColor: theme.buttonSecondary }]}>
                <Ionicons name="scan-outline" size={22} color={theme.tint} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.liveTitle, { color: theme.text }]}>Live scan</Text>
                <Text style={[styles.liveDescription, { color: theme.textSecondary }]}>Check a video call for manipulated faces and voices.</Text>
              </View>
            </View>

            <SmoothPressable
              accessibilityRole="button"
              accessibilityLabel={selectedLiveScreen ? 'Current screen selected. Change scan source.' : selectedLiveTarget ? `${selectedLiveTarget.label} selected. Change scan source.` : 'Choose an app or current screen to scan'}
              onPress={() => setPickerVisible(true)}
              style={({ pressed }) => [
                styles.liveSourceRow,
                { backgroundColor: theme.inputBackground, borderColor: theme.border, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              {selectedLiveTarget?.iconUri ? (
                <Image source={{ uri: selectedLiveTarget.iconUri }} style={styles.liveSourceIcon} />
              ) : (
                <View style={[styles.liveSourceIcon, styles.liveSourceFallback, { backgroundColor: theme.buttonSecondary }]}>
                  <Ionicons
                    name={selectedLiveScreen ? 'phone-portrait-outline' : selectedLiveTarget ? 'apps-outline' : 'add'}
                    size={20}
                    color={theme.tint}
                  />
                </View>
              )}
              <View style={styles.flex}>
                <Text style={[styles.liveSourceLabel, { color: theme.text }]} numberOfLines={1}>
                  {selectedLiveScreen ? 'App window or display' : selectedLiveTarget?.label ?? 'Choose a source'}
                </Text>
                <Text style={[styles.liveSourceHint, { color: theme.textSecondary }]} numberOfLines={1}>
                  {selectedLiveScreen
                    ? monitorStatus.sharing
                      ? 'Tap to stop sharing'
                      : 'Android will ask what you want to share'
                    : selectedLiveTarget
                    ? 'Tap to change'
                    : 'Select an app or share an app window or display'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </SmoothPressable>

            <View style={styles.liveStatusRow}>
              <View style={[styles.liveStatusDot, { backgroundColor: monitorStatus.sharing || monitorStatus.connected ? theme.success : monitorStatus.enabled ? theme.warning : theme.textSecondary }]} />
              <Text style={[styles.liveStatusText, { color: theme.textSecondary }]}>
                {monitorStatus.sharing
                  ? 'Screen share active'
                  : Platform.OS === 'web'
                  ? 'Preview available'
                  : monitorStatus.connected
                  ? 'Accessibility connected'
                  : monitorStatus.enabled
                  ? 'Accessibility service reconnecting'
                  : 'Accessibility setup needed'}
              </Text>
            </View>
          </View>
        )}

        {/* IMAGE TAB */}
        {selected === 'image' && (
          <View>
            {!currentStaged?.uri ? (
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel="Choose photo from library"
                disabled={busy}
                onPress={() => void pick('image')}
                style={({ pressed }) => [
                  styles.card,
                  styles.emptyCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.buttonSecondary }]}>
                  <Ionicons name="images-outline" size={34} color={theme.tint} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Select a photo to inspect
                </Text>
                <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                  Checks faces and photos for manipulation, AI smoothing, distorted features, and synthetic artifacts.
                </Text>
                <View style={[styles.cardCTA, { backgroundColor: theme.buttonPrimary, opacity: busy ? 0.5 : 1 }]}>
                  <Ionicons name="images-outline" size={20} color="#FFFFFF" accessible={false} />
                  <Text style={styles.cardCTALabel}>Choose from Photos</Text>
                </View>
              </SmoothPressable>
            ) : (
              <View style={[styles.card, styles.stagedCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.imageWrapper}>
                  <Image
                    source={{ uri: currentStaged.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <View style={styles.imageFloatingBar}>
                    <SmoothPressable
                      accessibilityRole="button"
                      accessibilityLabel="Replace photo"
                      onPress={() => void pick('image')}
                      disabled={busy}
                      style={styles.glassButton}
                    >
                      <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
                      <Text style={styles.glassButtonText}>Replace</Text>
                    </SmoothPressable>
                    <SmoothPressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      onPress={() => removeStaged('image')}
                      disabled={busy}
                      style={[styles.glassButton, styles.glassButtonDanger]}
                    >
                      <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.glassButtonText}>Remove</Text>
                    </SmoothPressable>
                  </View>
                </View>
                <View style={styles.mediaDetailsRow}>
                  <View style={styles.flex}>
                    <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                      {currentStaged.name ?? 'Selected photo'}
                    </Text>
                    <View style={styles.statusRow}>
                      <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                      <Text style={[styles.statusText, { color: theme.success }]}>
                        Photo ready for analysis
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* VIDEO TAB */}
        {selected === 'video' && (
          <View>
            {isVideoRestricted ? (
              <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.iconCircle, { backgroundColor: theme.buttonSecondary }]}>
                  <Ionicons name="videocam-off-outline" size={34} color={theme.warning} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Video scan requires Cloud AI
                </Text>
                <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                  On-device Gemma AI handles images and text offline. Switch to Gemini Cloud AI to analyze video clips.
                </Text>
                <Button
                  label="Switch to Cloud AI"
                  icon="sparkles"
                  variant="secondary"
                  onPress={() => router.push('/chat-settings' as Href)}
                  style={styles.cardCTA}
                />
              </View>
            ) : !currentStaged?.uri ? (
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel="Choose video clip"
                disabled={busy}
                onPress={() => void pick('video')}
                style={({ pressed }) => [
                  styles.card,
                  styles.emptyCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.buttonSecondary }]}>
                  <Ionicons name="videocam-outline" size={34} color={theme.tint} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Select a video clip
                </Text>
                <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
                  Upload an MP4, MOV, or WebM clip to check for face swaps, lip-sync mismatch, and synthetic drift.
                </Text>
                <View style={[styles.cardCTA, { backgroundColor: theme.buttonPrimary, opacity: busy ? 0.5 : 1 }]}>
                  <Ionicons name="videocam-outline" size={20} color="#FFFFFF" accessible={false} />
                  <Text style={styles.cardCTALabel}>Choose Video</Text>
                </View>
              </SmoothPressable>
            ) : (
              <View style={[styles.card, styles.stagedCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.fileRow}>
                  <View style={[styles.fileSquareIcon, { backgroundColor: theme.buttonSecondary }]}>
                    <Ionicons name="videocam" size={28} color={theme.tint} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                      {currentStaged.name ?? 'Video clip'}
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>
                      {formatSize(currentStaged.size) || 'Video clip ready'}
                    </Text>
                  </View>
                </View>
                <View style={styles.actionButtonGroup}>
                  <Button
                    label="Replace"
                    icon="swap-horizontal"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => void pick('video')}
                    style={styles.flex}
                  />
                  <Button
                    label="Remove"
                    icon="trash-outline"
                    variant="destructiveSecondary"
                    disabled={busy}
                    onPress={() => removeStaged('video')}
                    style={styles.flex}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* AUDIO TAB */}
        {selected === 'audio' && (
          <View>
            {!currentStaged?.uri ? (
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 20 }]}>
                {/* Voice Recorder Section */}
                <View style={styles.audioRecordSection}>
                  <SmoothPressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      recorder.recording
                        ? `Stop recording, ${formatDuration(recorder.durationMs)} elapsed`
                        : 'Start voice recording'
                    }
                    disabled={busy && !recorder.recording}
                    onPress={() => void record()}
                    style={[
                      styles.recordRing,
                      {
                        borderColor: recorder.recording ? theme.danger : theme.tint,
                        backgroundColor: recorder.recording ? (theme.danger + '18') : theme.buttonSecondary,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.recordCenter,
                        {
                          backgroundColor: recorder.recording ? theme.danger : theme.tint,
                          borderRadius: recorder.recording ? 6 : 26,
                          width: recorder.recording ? 22 : 52,
                          height: recorder.recording ? 22 : 52,
                        },
                      ]}
                    >
                      {!recorder.recording && <Ionicons name="mic" size={26} color="#FFFFFF" />}
                    </View>
                  </SmoothPressable>
                  <Text
                    style={[
                      styles.recordTimer,
                      { color: recorder.recording ? theme.danger : theme.text },
                    ]}
                  >
                    {recorder.recording ? formatDuration(recorder.durationMs) : 'Tap to Record'}
                  </Text>
                  <Text style={[styles.cardDescription, { color: theme.textSecondary, marginTop: -2 }]}>
                    {recorder.recording
                      ? 'Speaking... Tap the red square to finish'
                      : 'Record speech to detect cloned voices or AI audio'}
                  </Text>
                </View>

                {/* Apple Inset Divider */}
                {!recorder.recording && (
                  <>
                    <View style={styles.orDivider}>
                      <View style={[styles.dividerBar, { backgroundColor: theme.border }]} />
                      <Text style={[styles.orText, { color: theme.textSecondary }]}>OR</Text>
                      <View style={[styles.dividerBar, { backgroundColor: theme.border }]} />
                    </View>

                    <Button
                      label="Choose Audio File"
                      icon="folder-open-outline"
                      variant="secondary"
                      disabled={busy}
                      onPress={() => void pick('audio')}
                      style={{ width: '100%' }}
                    />
                  </>
                )}
              </View>
            ) : (
              <View style={[styles.card, styles.stagedCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.fileRow}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                      {currentStaged.name ?? 'Audio clip'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <AudioChip uri={currentStaged.uri} isUser={false} />
                      {!!currentStaged.size && (
                        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                          {formatSize(currentStaged.size)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.actionButtonGroup}>
                  <Button
                    label="Re-record"
                    icon="mic-outline"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => void record()}
                    style={styles.flex}
                  />
                  <Button
                    label="Remove"
                    icon="trash-outline"
                    variant="destructiveSecondary"
                    disabled={busy}
                    onPress={() => removeStaged('audio')}
                    style={styles.flex}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* TEXT TAB */}
        {selected === 'text' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 14 }]}>
            <TextInput
              accessibilityLabel="Message or text to scan"
              multiline
              numberOfLines={6}
              maxLength={5000}
              editable={!busy}
              placeholder="Paste a message, email, social post, or suspicious link to inspect for scams, phishing, harassment, or AI manipulation..."
              placeholderTextColor={theme.textSecondary}
              onChangeText={(v) =>
                setStagedMap((prev) => ({
                  ...prev,
                  text: { kind: 'text', text: v },
                }))
              }
              value={currentStaged?.text ?? ''}
              style={[
                styles.textInputArea,
                {
                  color: theme.text,
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                },
              ]}
            />
            <View style={styles.textFooterRow}>
              <Text style={[styles.counterText, { color: theme.textSecondary }]}>
                {(currentStaged?.text?.length ?? 0).toLocaleString()} / 5,000 characters
              </Text>
              {!!currentStaged?.text && (
                <SmoothPressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear entered text"
                  disabled={busy}
                  onPress={() =>
                    setStagedMap((prev) => ({
                      ...prev,
                      text: { kind: 'text', text: '' },
                    }))
                  }
                  hitSlop={8}
                >
                  <Text style={{ color: theme.tint, fontSize: 13, fontWeight: '600' }}>
                    Clear
                  </Text>
                </SmoothPressable>
              )}
            </View>
          </View>
        )}
      </Animated.View>

      {/* CTA Button & Security Caption */}
      <Animated.View entering={enter(3)} style={styles.ctaContainer}>
        <Button
          label={
            selected === 'live'
              ? selectedLiveScreen
                ? monitorStatus.sharing
                  ? 'Stop screen share'
                  : 'Choose what to share'
                : selectedLiveTarget
                ? 'Start live scan'
                : 'Choose a source'
              : running
              ? 'Analysing…'
              : canRun
              ? `Scan ${activeTabMeta.badgeLabel}`
              : selected === 'text'
              ? 'Enter text to scan'
              : `Select ${activeTabMeta.badgeLabel.toLowerCase()} to scan`
          }
          icon={
            selected === 'live'
              ? selectedLiveScreen
                ? monitorStatus.sharing
                  ? 'stop-circle-outline'
                  : 'share-outline'
                : selectedLiveTarget
                ? 'play-outline'
                : 'apps-outline'
              : running
              ? undefined
              : 'scan-outline'
          }
          loading={running}
          disabled={selected === 'live' ? false : !canRun || running}
          onPress={() => void run()}
          style={styles.mainScanButton}
        />
        {running && (
          <Button
            label="Cancel analysis"
            variant="secondary"
            onPress={() => abortRef.current?.abort()}
            style={{ width: '100%' }}
          />
        )}
        {selected !== 'live' && (
          <View style={styles.privacyCaption}>
            <Ionicons
              name={isLocal ? 'shield-checkmark-outline' : 'lock-closed-outline'}
              size={13}
              color={theme.textSecondary}
            />
            <Text style={[styles.privacyCaptionText, { color: theme.textSecondary }]}>
              {isLocal
                ? '100% on-device analysis · No data leaves this device'
                : 'Secure Cloud AI analysis · Results saved locally'}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* App & Screen Picker Sheet */}
      <LiveScanPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelectApp={handleSelectApp}
        onSelectScreen={handleSelectScreen}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 36,
  },
  flex: { flex: 1 },
  header: {
    gap: 4,
    marginTop: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.screenTitle,
  },
  subtitle: {
    ...typography.body,
    marginTop: 2,
    lineHeight: 20,
  },
  enginePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  enginePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  warnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  compactBtn: {
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 9,
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
  },
  segmentText: {
    fontSize: 12,
  },
  segmentDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stageContainer: {
    minHeight: 220,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveCard: {
    padding: 18,
    gap: 16,
  },
  liveIntroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveIconTile: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  liveTitle: {
    ...typography.cardTitle,
  },
  liveDescription: {
    ...typography.caption,
    marginTop: 1,
  },
  liveSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    padding: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveSourceIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
  },
  liveSourceFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveSourceLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  liveSourceHint: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 1,
  },
  liveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    marginTop: -5,
  },
  liveStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveStatusText: {
    fontSize: 12,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  stagedCard: {
    padding: 14,
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  cardCTA: {
    marginTop: 8,
    width: '100%',
    maxWidth: 240,
    minHeight: 48,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardCTALabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  imageWrapper: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  imageFloatingBar: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  glassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  glassButtonDanger: {
    backgroundColor: 'rgba(180, 35, 35, 0.82)',
  },
  glassButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  mediaDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileSquareIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  audioRecordSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  recordRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  recordCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTimer: {
    fontSize: 19,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 10,
  },
  dividerBar: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  orText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  textInputArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 140,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  textFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  counterText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  ctaContainer: {
    gap: 10,
    marginTop: 2,
  },
  mainScanButton: {
    minHeight: 52,
    borderRadius: 14,
  },
  privacyCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 2,
  },
  privacyCaptionText: {
    fontSize: 12,
  },
});
