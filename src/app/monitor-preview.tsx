// Web/preview surface that mirrors the Android MaalamMonitorService overlay:
// draggable pill indicator, floating utility bar, alert banner and detection
// report popup over a fake app feed or live video call.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { newId } from '@/db/client';
import { insertDetection } from '@/db/detections';
import type { MonitorFinding } from '@/monitor/native';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

const FRAME_W = 360;
const FRAME_H = 720;
const FAB_SIZE = 44;
const BADGE_SIZE = 8;

const IDLE_GREEN = '#34C759';
const SCAN_PURPLE = '#B39DFF';
const ALERT_RED = '#FF6B63';
const MANUAL_ORANGE = '#D9822B';

/** Hex (#RRGGBB) + alpha → rgba(), for tinted overlay surfaces on theme cards. */
function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const DEMO_POSTS = [
  { caption: 'POV: the celebrity "leaked" video everyone is sharing' },
  { caption: 'This face-swap filter is getting scary good…' },
];

const DEMO_LINKS = [
  'https://social.example/post/8812-leaked-video',
  'https://clips.example/watch?v=face-swap',
];

interface DemoResult {
  detectionId: string;
  verdict: string;
  confidence: number;
  summary: string;
  findings: MonitorFinding[];
}

export default function MonitorPreviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const reduceMotion = useReduceMotion();
  const params = useLocalSearchParams<{ app?: string; autoScan?: string }>();

  const appLabel = params.app || 'Google Meet';
  const isVideoCall =
    !params.app ||
    ['meet', 'zoom', 'whatsapp', 'telegram', 'teams', 'call', 'stream', 'screen', 'discord', 'video'].some(
      (k) => appLabel.toLowerCase().includes(k)
    );

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [barVisible, setBarVisible] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [toolInput, setToolInput] = useState('');
  const [toolReply, setToolReply] = useState(
    'Ask a question, detect a link on this screen, or capture what you see for a verdict report.'
  );
  const [toolBusy, setToolBusy] = useState(false);
  const [detectIndex, setDetectIndex] = useState(-1);
  const [liveMode, setLiveMode] = useState(true);
  const [stagedScreenshot, setStagedScreenshot] = useState<string | null>(null);
  const [modeTrackW, setModeTrackW] = useState(0);
  const [chatLog, setChatLog] = useState<
    { id: number; role: 'user' | 'assistant'; text: string; image?: boolean }[]
  >([]);
  const chatScrollRef = useRef<ScrollView>(null);
  const chatSeq = useRef(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsFade] = useState(() => new Animated.Value(0));
  const [plusRot] = useState(() => new Animated.Value(0));
  const [linkDot] = useState(() => new Animated.Value(0));
  const say = useCallback((text: string) => {
    setChatLog((prev) =>
      [...prev, { id: ++chatSeq.current, role: 'assistant' as const, text }].slice(-12)
    );
  }, []);

  const toggleTools = () => {
    if (toolsOpen) {
      Animated.parallel([
        Animated.timing(toolsFade, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(plusRot, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => setToolsOpen(false));
    } else {
      setToolsOpen(true);
      Animated.parallel([
        Animated.timing(toolsFade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(plusRot, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  };
  const plusRotate = plusRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  const [pos] = useState(() => new Animated.ValueXY({ x: FRAME_W - FAB_SIZE, y: 200 }));
  const [pulse] = useState(() => new Animated.Value(1));
  const [switchAnim] = useState(() => new Animated.Value(0));
  const [sectionAnim] = useState(() => new Animated.Value(1));
  const [flashAnim] = useState(() => new Animated.Value(0));
  const [motionPulse] = useState(() => new Animated.Value(0.85));
  const [popupAnim] = useState(() => new Animated.Value(0));
  const barTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draggable bubble; snap to the nearest frame edge on release.
  const [drag] = useState(() => ({ x: 0, y: 0 }));
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
      onPanResponderMove: (_, g) => {
        pos.setValue({
          x: Math.max(0, Math.min(FRAME_W - FAB_SIZE, drag.x + g.dx)),
          y: Math.max(0, Math.min(FRAME_H - FAB_SIZE, drag.y + g.dy)),
        });
      },
      onPanResponderRelease: () => {
        pos.stopAnimation((v) => {
          const x = v.x + FAB_SIZE / 2 < FRAME_W / 2 ? 0 : FRAME_W - FAB_SIZE;
          Animated.timing(pos, { toValue: { x, y: v.y }, duration: 120, useNativeDriver: false }).start();
        });
      },
      onPanResponderGrant: () => {
        pos.stopAnimation((v) => {
          drag.x = v.x;
          drag.y = v.y;
        });
      },
    })
  );

  useEffect(() => {
    if (!scanning || reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 350, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 350, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => {
      animation.stop();
      pulse.setValue(1);
    };
  }, [scanning, reduceMotion, pulse]);

  useEffect(() => () => {
    if (barTimer.current) clearTimeout(barTimer.current);
  }, []);

  // Dot traveling along the header connector: monitored app → Maalam.
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(linkDot, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => {
      loop.stop();
      linkDot.setValue(0);
    };
  }, [reduceMotion, linkDot]);

  const simulateScan = () => {
    setScanning(true);
    setTimeout(() => setScanning(false), 1500);
  };

  const simulateDetection = useCallback(async () => {
    setScanning(true);
    const detectionId = newId();
    const demo: DemoResult = isVideoCall
      ? {
          detectionId,
          verdict: 'deepfake',
          confidence: 91,
          summary:
            'Live video call analysis detected real-time face-swap blending and synthetic audio sync anomalies. High likelihood of AI manipulation.',
          findings: [
            {
              category: 'deepfake',
              label: 'Face-swap boundary blending',
              confidence: 92,
              description:
                'Temporal flickering and unnatural skin texture boundaries around the jawline and eyes.',
            },
            {
              category: 'harmful',
              label: 'Audio-visual lip-sync delay',
              confidence: 88,
              description:
                'Voice phonemes desynchronized from lip movements by ~190ms, characteristic of live speech synthesis.',
            },
            {
              category: 'ai_generated',
              label: 'Synthetic facial micro-expression',
              confidence: 84,
              description:
                'Blinking frequency and gaze tracking do not match natural human conversational cadence.',
            },
          ],
        }
      : {
          detectionId,
          verdict: 'deepfake',
          confidence: 87,
          summary:
            'The face in this video shows face-swap blending artifacts and the caption pushes a false claim. Treat this clip as likely AI-manipulated.',
          findings: [
            {
              category: 'deepfake',
              label: 'Face-swap artifacts',
              confidence: 87,
              description:
                'Blurred edges and inconsistent lighting around the face suggest a swapped face.',
            },
            {
              category: 'ai_generated',
              label: 'AI-generated background',
              confidence: 72,
              description:
                'The background contains warped text and repeating patterns typical of generated imagery.',
            },
            {
              category: 'harmful',
              label: 'Misleading caption',
              confidence: 64,
              description: 'The caption presents a fabricated clip as a real leaked video.',
            },
          ],
        };

    try {
      await insertDetection({
        id: detectionId,
        packageName: isVideoCall ? 'com.google.android.apps.tachyon' : 'com.zhiliaoapp.musically',
        appLabel,
        verdict: 'deepfake',
        confidence: demo.confidence,
        summary: demo.summary,
        findings: demo.findings,
        screenshotUri: null,
        screenText: isVideoCall ? 'Incoming Live Video Call Stream' : DEMO_POSTS.map((p) => p.caption).join('\n'),
        provider: settings.provider,
        createdAt: Date.now(),
      });
    } catch (e) {
      console.warn('Demo detection insert failed:', e);
    }
    setTimeout(() => {
      setScanning(false);
      setResult(demo);
      setBarVisible(true);
      if (barTimer.current) clearTimeout(barTimer.current);
      barTimer.current = setTimeout(() => setBarVisible(false), 5000);
    }, 1500);
  }, [appLabel, isVideoCall, settings.provider]);

  // Auto-trigger detection when launched via Live Scan
  useEffect(() => {
    if (params.autoScan === 'true') {
      const timer = setTimeout(() => {
        void simulateDetection();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [params.autoScan, simulateDetection]);

  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(motionPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(motionPulse, { toValue: 0.72, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, motionPulse]);

  // Keep the chat thread pinned to the newest bubble.
  useEffect(() => {
    chatScrollRef.current?.scrollToEnd({ animated: true });
  }, [chatLog, toolReply, result]);

  const openPopup = () => result && setPopupVisible(true);
  const dismissPopup = () => {
    setPopupVisible(false);
    setResult(null);
  };

  const openTools = () => {
    setBarVisible(false);
    setToolsVisible(true);
    popupAnim.setValue(0);
    Animated.spring(popupAnim, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }).start();
    if (!liveMode && !toolInput.trim() && !stagedScreenshot) {
      setDetectIndex(0);
      setToolInput(DEMO_LINKS[0]);
      setToolReply(
        `Link 1 of ${DEMO_LINKS.length} detected on screen · Tap send ↑ to verify or ask a question.`
      );
    }
  };
  const closeTools = () => {
    Animated.timing(popupAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setToolsVisible(false);
    });
  };

  const toggleLiveMode = () => {
    const next = !liveMode;
    setLiveMode(next);
    // JS driver: the thumb slides and shifts colour in the same motion.
    Animated.spring(switchAnim, { toValue: next ? 0 : 1, friction: 7, tension: 40, useNativeDriver: false }).start();
    sectionAnim.setValue(0);
    Animated.timing(sectionAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    if (!next && !toolInput.trim() && !stagedScreenshot) {
      // Entering manual: immediately read a link off the simulated screen.
      setDetectIndex(0);
      setToolInput(DEMO_LINKS[0]);
      setToolReply(
        `Link 1 of ${DEMO_LINKS.length} detected on screen · Tap send ↑ to verify or ask a question.`
      );
    } else {
      setToolReply(
        next
          ? `Live monitoring active on ${appLabel} — frames are scanned automatically.`
          : `Manual mode active — nothing scans until you capture a screenshot or send content.`
      );
    }
  };

  const detectLink = () => {
    const next = (detectIndex + 1) % DEMO_LINKS.length;
    setDetectIndex(next);
    setToolInput(DEMO_LINKS[next]);
    setToolReply(
      `Detected link ${next + 1} of ${DEMO_LINKS.length} on this screen. Tap send ↑ to verify.`
    );
  };

  const pasteLink = () => {
    setToolInput(DEMO_LINKS[0]);
    setToolReply('Pasted link from clipboard into inspector. Tap send ↑ to verify.');
  };

  const attachScreenshot = () => {
    flashAnim.setValue(0.75);
    Animated.timing(flashAnim, { toValue: 0, duration: 320, useNativeDriver: true }).start();
    setStagedScreenshot('screenshot_' + Date.now() + '.jpg');
    setToolReply('Screenshot attached! Tap send ↑ to verify with verdict report.');
  };

  const sendTool = () => {
    const prompt = toolInput.trim();
    if (!prompt && !stagedScreenshot) return;
    if (toolBusy) return;
    // Links and captures go to the detector for a verdict report; plain
    // questions get an in-panel answer so the user can ask about it.
    const inspect = !!stagedScreenshot || /(https?:\/\/|www\.)\S+/i.test(prompt);
    setChatLog((prev) =>
      [...prev, {
        id: ++chatSeq.current,
        role: 'user' as const,
        text: prompt || 'Attached a screenshot',
        image: !!stagedScreenshot,
      }].slice(-12)
    );
    setToolBusy(true);
    setToolReply(inspect ? 'Running deepfake & manipulation detector…' : 'Thinking…');
    setTimeout(() => {
      setToolBusy(false);
      if (inspect) {
        setStagedScreenshot(null);
        setToolInput('');
        setToolReply('');
        say('Verdict ready — the scan result is shown below.');
        void simulateDetection();
      } else {
        setToolInput('');
        setToolReply('');
        say(
          'No strong signs of AI manipulation in what you pasted. Send a link or a screenshot for a full verdict report.'
        );
      }
    }, 900);
  };

  const stateColor = scanning ? SCAN_PURPLE : result ? ALERT_RED : liveMode ? IDLE_GREEN : '#FFB74D';
  const stateLabel = scanning ? 'Scanning' : result ? 'Flagged' : liveMode ? 'Running' : 'Manual';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Top Navigation bar */}
      <View style={styles.topNav}>
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel="Back to scan"
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.text} />
          <Text style={[styles.backBtnText, { color: theme.text }]}>Back to Scan</Text>
        </SmoothPressable>
        <Text style={[styles.topNavTitle, { color: theme.textSecondary }]}>
          Live Video Call & Overlay Simulation
        </Text>
      </View>

      {/* Frame simulating monitored app screen */}
      <View style={[styles.frame, { borderColor: theme.border }]}>
        {/* App Title Bar */}
        <View style={styles.appHeader}>
          <Text style={styles.appTitle}>{appLabel}</Text>
          {isVideoCall && (
            <View style={styles.callBadge}>
              <View style={styles.callDot} />
              <Text style={styles.callDuration}>01:24</Text>
            </View>
          )}
        </View>

        {isVideoCall ? (
          /* Live Video Call Screen Simulation */
          <View style={styles.videoCallBody}>
            {/* Caller Video Stream Box */}
            <View style={styles.callerVideoBox}>
              {/* Face Tracking HUD / Scanning Mesh */}
              <View
                style={[
                  styles.faceScanHud,
                  {
                    borderColor: scanning ? '#7C3AED' : result ? ALERT_RED : '#2E7D32',
                  },
                ]}
              >
                <View style={styles.hudCornerTL} />
                <View style={styles.hudCornerTR} />
                <View style={styles.hudCornerBL} />
                <View style={styles.hudCornerBR} />
                <Ionicons
                  name={result ? 'warning' : 'person'}
                  size={76}
                  color={result ? ALERT_RED : '#555566'}
                />
                <Text
                  style={[
                    styles.hudLabel,
                    {
                      color: scanning ? '#7C3AED' : result ? ALERT_RED : '#2E7D32',
                    },
                  ]}
                >
                  {scanning
                    ? 'AI: TRACKING FACE MESH & SPEECH CADENCE'
                    : result
                    ? 'DEFECT FLAGGED: FACE-SWAP ARTIFACTS'
                    : 'LIVE STREAM VERIFIED'}
                </Text>
              </View>

              {/* Caller Identification Tag */}
              <View style={styles.callerTag}>
                <Text style={styles.callerName}>Active Video Caller</Text>
                <Text style={styles.callerSub}>Live 1080p stream</Text>
              </View>
            </View>

            {/* In-Call Controls Strip */}
            <View style={styles.callControlsStrip}>
              <View style={styles.controlCircle}>
                <Ionicons name="mic" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.controlCircle}>
                <Ionicons name="videocam" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.controlCircle}>
                <Ionicons name="volume-high" size={20} color="#FFFFFF" />
              </View>
              <View style={[styles.controlCircle, styles.endCallCircle]}>
                <Ionicons name="call" size={20} color="#FFFFFF" />
              </View>
            </View>
          </View>
        ) : (
          /* Feed Post Simulation (e.g. TikTok) */
          DEMO_POSTS.map((post, i) => (
            <View key={i} style={styles.post}>
              <View style={styles.postImage}>
                <Ionicons name="image-outline" size={40} color="#9A9AA3" />
              </View>
              <Text style={styles.postCaption} numberOfLines={2}>
                {post.caption}
              </Text>
            </View>
          ))
        )}

        {/* Camera shutter flash effect when screenshot is captured */}
        <Animated.View
          style={[styles.shutterFlash, { opacity: flashAnim }]}
          pointerEvents="none"
        />

        {/* Alert banner */}
        {barVisible && (
          <SmoothPressable style={styles.alertBar} onPress={openPopup}>
            <Ionicons name="warning" size={16} color="#FFFFFF" />
            <Text style={styles.alertTitle}>
              Potential {result?.verdict.replace('_', ' ')} detected · Tap to view
            </Text>
          </SmoothPressable>
        )}

        {/* Floating circular FAB indicator */}
        <Animated.View
          {...pan.panHandlers}
          style={[styles.pill, { backgroundColor: theme.card, borderColor: stateColor }, { transform: pos.getTranslateTransform() }]}
        >
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel={`Maalam monitor: ${stateLabel}. Tap to open Maalam tools.`}
            onPress={openTools}
            style={styles.pillTap}
          >
            <Animated.View style={{ opacity: scanning ? pulse : 1 }}>
              <Ionicons name="shield-checkmark" size={16} color={stateColor} />
            </Animated.View>
          </SmoothPressable>
          {result && (
            <View style={styles.fabBadge} />
          )}
        </Animated.View>

        {!toolsVisible && (
          <Text style={[styles.monitorStatus, { left: 0, color: theme.textSecondary }]} accessibilityLiveRegion="polite">
            {scanning
              ? 'Scanning…'
              : result
              ? 'Flagged · tap to view'
              : 'Monitoring active'}
          </Text>
        )}

        {/* Floating tools popup (animated motion, app logo, big mode switch, screenshot, detect link, ask) */}
        {toolsVisible && (
          <Animated.View
            style={[
              styles.toolsBar,
              { backgroundColor: theme.card, borderColor: theme.border },
              {
                opacity: popupAnim,
                transform: [
                  { translateY: popupAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                  { scale: popupAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                ],
              },
            ]}
          >
            {/* 1. Header: open-app (left) — linked logo chain (center) — close (right) */}
            <View style={styles.appHeaderRow}>
              <View style={[styles.headerSide, styles.headerLeft]}>
                <SmoothPressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Maalam app"
                  onPress={() => router.back()}
                  hitSlop={8}
                  style={styles.closeBtn}
                >
                  <Ionicons name="open-outline" size={19} color={theme.textSecondary} />
                </SmoothPressable>
              </View>
              <View style={styles.linkChain}>
                <View style={[styles.appLogoBox, { backgroundColor: theme.buttonSecondary, borderColor: theme.border }]}>
                  <Ionicons
                    name={isVideoCall ? 'videocam' : 'musical-notes'}
                    size={27}
                    color={theme.text}
                  />
                </View>
                <View style={styles.linkConnector}>
                  <Animated.View
                    style={{
                      opacity: linkDot.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.35, 1, 0.35],
                      }),
                    }}
                  >
                    <Ionicons name="link" size={15} color={theme.textSecondary} />
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.linkDot,
                      { backgroundColor: theme.tint },
                      {
                        opacity: linkDot.interpolate({
                          inputRange: [0, 0.15, 0.85, 1],
                          outputRange: [0, 1, 1, 0],
                        }),
                        transform: [
                          {
                            translateX: linkDot.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 22],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>
                <View style={[styles.appLogoBox, { backgroundColor: theme.buttonSecondary, borderColor: theme.border }]}>
                  <Image
                    source={require('../../assets/images/icon.png')}
                    style={styles.maalamLogo}
                    accessibilityLabel="Maalam"
                  />
                  <View style={[styles.maalamBadgeDot, { backgroundColor: stateColor, borderColor: theme.card }]} />
                </View>
              </View>
              <View style={[styles.headerSide, styles.headerRight]}>
                <SmoothPressable
                  accessibilityRole="button"
                  accessibilityLabel="Close Maalam tools"
                  onPress={closeTools}
                  hitSlop={8}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </SmoothPressable>
              </View>
            </View>

            {/* 2. Animated Motion Status Banner */}
            <Animated.View
              style={[
                styles.motionBanner,
                {
                  opacity: motionPulse,
                  backgroundColor: alpha(stateColor, 0.12),
                  borderColor: alpha(stateColor, 0.3),
                },
              ]}
            >
              <Ionicons name="sparkles" size={16} color={stateColor} />
              <Text style={[styles.motionBannerText, { color: stateColor }]} numberOfLines={1}>
                {scanning
                  ? 'Analyzing stream in real-time…'
                  : liveMode
                  ? 'Active Guard · Live protection active'
                  : 'Manual Mode · Ready to inspect on demand'}
              </Text>
            </Animated.View>

            {/* 3. Big on/off toggle: shows only the active mode */}
            <SmoothPressable
              accessibilityRole="switch"
              accessibilityState={{ checked: liveMode }}
              accessibilityLabel={liveMode ? 'Live Mode on. Switch to Manual Mode' : 'Manual Mode on. Switch to Live Mode'}
              onPress={toggleLiveMode}
              onLayout={(e) => setModeTrackW(e.nativeEvent.layout.width)}
              style={styles.modeToggleWrap}
            >
              <Animated.View
                style={[
                  styles.modeToggle,
                  {
                    backgroundColor: switchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [theme.buttonPrimary, MANUAL_ORANGE],
                    }),
                  },
                ]}
              >
                {/* Sliding knob: right = Live (on), left = Manual (off) */}
                <Animated.View
                  style={[
                    styles.modeKnob,
                    {
                      transform: [
                        {
                          translateX: switchAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [Math.max(0, modeTrackW - 46), 0],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                {/* Active mode label — crossfades on switch */}
                <Animated.Text
                  style={[
                    styles.modeToggleLabel,
                    { opacity: switchAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
                  ]}
                >
                  Live Mode
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.modeToggleLabel,
                    { opacity: switchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
                  ]}
                >
                  Manual Mode
                </Animated.Text>
              </Animated.View>
            </SmoothPressable>

            {/* Verdict summary card — standalone in live mode; manual shows it in-thread */}
            {result && liveMode && (
              <View style={[styles.verdictMini, { backgroundColor: alpha(theme.danger, 0.08), borderColor: alpha(theme.danger, 0.35) }]}>
                <View style={styles.verdictMiniTop}>
                  <Ionicons name="warning" size={16} color={theme.danger} />
                  <Text style={[styles.verdictMiniLabel, { color: theme.danger }]} numberOfLines={1}>
                    {result.verdict.replace('_', ' ').toUpperCase()} · {result.confidence}%
                  </Text>
                </View>
                <Text style={[styles.verdictMiniSummary, { color: theme.text }]} numberOfLines={2}>
                  {result.summary}
                </Text>
                <View style={styles.verdictMiniActions}>
                  <SmoothPressable
                    accessibilityRole="button"
                    accessibilityLabel="View full verdict report"
                    onPress={() => { setToolsVisible(false); setPopupVisible(true); }}
                    hitSlop={6}
                  >
                    <Text style={[styles.verdictMiniBtn, { color: theme.tint }]}>View result</Text>
                  </SmoothPressable>
                  <SmoothPressable
                    accessibilityRole="button"
                    accessibilityLabel="Open result in Maalam app"
                    onPress={() => router.push(`/detections/${result.detectionId}`)}
                    hitSlop={6}
                  >
                    <Text style={[styles.verdictMiniBtn, { color: theme.tint }]}>Open app ›</Text>
                  </SmoothPressable>
                </View>
              </View>
            )}

            {/* 4. Mode sections: live = status only · manual = inspect tools */}
            <Animated.View
              style={{
                opacity: sectionAnim,
                transform: [
                  { translateY: sectionAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                ],
              }}
            >
              {liveMode ? (
                <View style={[styles.modeHint, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                  <Ionicons name="scan" size={17} color={stateColor} />
                  <Text style={[styles.modeHintText, { color: theme.textSecondary }]}>
                    Live Mode is auto-scanning this screen. Switch to Manual Mode to inspect on demand.
                  </Text>
                </View>
              ) : (
                <View>
                  {/* Staged Screenshot Preview Chip */}
                  {stagedScreenshot && (
                    <View style={[styles.screenshotChip, { backgroundColor: alpha(theme.tint, 0.12), borderColor: alpha(theme.tint, 0.35) }]}>
                      <Ionicons name="image" size={16} color={theme.tint} />
                      <Text style={[styles.screenshotChipText, { color: theme.tint }]} numberOfLines={1}>Screenshot attached · ready to verify</Text>
                      <SmoothPressable onPress={() => setStagedScreenshot(null)} hitSlop={6}>
                        <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                      </SmoothPressable>
                    </View>
                  )}

                  {/* Chat thread: user / assistant bubbles, image, verdict, status */}
                  <ScrollView
                    ref={chatScrollRef}
                    style={styles.chatScroll}
                    contentContainerStyle={styles.chatThread}
                    showsVerticalScrollIndicator={false}
                  >
                    {chatLog.map((m) => (
                      <View
                        key={m.id}
                        style={[styles.chatRow, m.role === 'user' && styles.chatRowEnd]}
                      >
                        <View
                          style={[
                            styles.chatBubble,
                            {
                              backgroundColor:
                                m.role === 'user' ? theme.buttonPrimary : theme.inputBackground,
                            },
                          ]}
                        >
                          {m.image && (
                            <View style={styles.chatImage}>
                              <Ionicons name="image" size={22} color="rgba(255,255,255,0.9)" />
                            </View>
                          )}
                          <Text
                            style={[
                              styles.chatText,
                              { color: m.role === 'user' ? '#FFFFFF' : theme.text },
                            ]}
                          >
                            {m.text}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {result && (
                      <View style={styles.chatRow}>
                        <View
                          style={[
                            styles.verdictMini,
                            styles.chatVerdict,
                            {
                              backgroundColor: alpha(theme.danger, 0.08),
                              borderColor: alpha(theme.danger, 0.35),
                            },
                          ]}
                        >
                          <View style={styles.verdictMiniTop}>
                            <Ionicons name="warning" size={16} color={theme.danger} />
                            <Text
                              style={[styles.verdictMiniLabel, { color: theme.danger }]}
                              numberOfLines={1}
                            >
                              {result.verdict.replace('_', ' ').toUpperCase()} · {result.confidence}%
                            </Text>
                          </View>
                          <Text
                            style={[styles.verdictMiniSummary, { color: theme.text }]}
                            numberOfLines={2}
                          >
                            {result.summary}
                          </Text>
                          <View style={styles.verdictMiniActions}>
                            <SmoothPressable
                              accessibilityRole="button"
                              accessibilityLabel="View full verdict report"
                              onPress={() => { setToolsVisible(false); setPopupVisible(true); }}
                              hitSlop={6}
                            >
                              <Text style={[styles.verdictMiniBtn, { color: theme.tint }]}>View result</Text>
                            </SmoothPressable>
                            <SmoothPressable
                              accessibilityRole="button"
                              accessibilityLabel="Open result in Maalam app"
                              onPress={() => router.push(`/detections/${result.detectionId}`)}
                              hitSlop={6}
                            >
                              <Text style={[styles.verdictMiniBtn, { color: theme.tint }]}>Open app ›</Text>
                            </SmoothPressable>
                          </View>
                        </View>
                      </View>
                    )}
                    {!!toolReply && (
                      <View style={styles.chatRow}>
                        <View style={[styles.chatBubble, { backgroundColor: theme.inputBackground }]}>
                          <Text style={[styles.chatText, { color: theme.text }]}>{toolReply}</Text>
                        </View>
                      </View>
                    )}
                  </ScrollView>

                  {/* Tools row revealed by the + button: Detect / Paste / Attach */}
                  {toolsOpen && (
                    <Animated.View style={[styles.chipRow, { opacity: toolsFade }]}>
                      <SmoothPressable
                        style={[styles.chip, { backgroundColor: theme.buttonPrimary }]}
                        onPress={attachScreenshot}
                        accessibilityLabel="Attach a screenshot or image"
                      >
                        <Ionicons name="image" size={16} color="#FFFFFF" />
                        <Text style={styles.chipTextAccent}>Attach</Text>
                      </SmoothPressable>
                      <SmoothPressable style={[styles.chip, { backgroundColor: theme.buttonSecondary }]} onPress={detectLink} accessibilityLabel="Detect link on this screen">
                        <Ionicons name="link" size={16} color={theme.text} />
                        <Text style={[styles.chipText, { color: theme.text }]}>Detect link</Text>
                      </SmoothPressable>
                      <SmoothPressable style={[styles.chip, { backgroundColor: theme.buttonSecondary }]} onPress={pasteLink} accessibilityLabel="Paste from clipboard">
                        <Ionicons name="clipboard-outline" size={16} color={theme.text} />
                        <Text style={[styles.chipText, { color: theme.text }]}>Paste link</Text>
                      </SmoothPressable>
                    </Animated.View>
                  )}

                  {/* Slim composer pill: + tools toggle, inline input, send circle */}
                  <View style={[styles.inputPill, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                    <SmoothPressable
                      accessibilityRole="button"
                      accessibilityLabel="Show tools: detect link, paste link, attach"
                      onPress={toggleTools}
                      style={[styles.plusBtn, { backgroundColor: theme.buttonSecondary }]}
                    >
                      <Animated.View style={{ transform: [{ rotate: plusRotate }] }}>
                        <Ionicons name="add" size={18} color={theme.text} />
                      </Animated.View>
                    </SmoothPressable>
                    <TextInput
                      value={toolInput}
                      onChangeText={setToolInput}
                      placeholder={stagedScreenshot ? "Ask about this capture or send to inspect…" : "Ask, paste text or link to verify…"}
                      placeholderTextColor={theme.textSecondary}
                      editable={!toolBusy}
                      multiline
                      style={[styles.toolsInput, { color: theme.text }]}
                      accessibilityLabel="Message or public URL"
                    />
                    <SmoothPressable
                      accessibilityRole="button"
                      accessibilityLabel="Send to Maalam for verdict report"
                      onPress={sendTool}
                      disabled={toolBusy || (!toolInput.trim() && !stagedScreenshot)}
                      style={[styles.toolsSend, { backgroundColor: theme.buttonPrimary }, (!toolInput.trim() && !stagedScreenshot || toolBusy) && { opacity: 0.5 }]}
                    >
                      <Ionicons name="arrow-up" size={17} color="#FFFFFF" />
                    </SmoothPressable>
                  </View>
                </View>
              )}
            </Animated.View>
          </Animated.View>
        )}

        {/* Popup */}
        {popupVisible && result && (
          <View style={styles.popupWrap} pointerEvents="box-none">
            <SmoothPressable
              style={styles.scrim}
              onPress={dismissPopup}
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
            />
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.badgeRow}>
                <Ionicons name="warning" size={20} color={theme.danger} />
                <View style={styles.verdictBadge}>
                  <Text style={styles.verdictBadgeText}>
                    {result.verdict.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>{result.confidence}% confidence</Text>
              </View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                {isVideoCall
                  ? 'Deepfake or AI-manipulated video call detected'
                  : 'Deepfake, AI-generated or harmful content detected'}
              </Text>
              <Text style={[styles.cardApp, { color: theme.textSecondary }]}>in {appLabel}</Text>
              {result.findings.map((f, i) => (
                <View key={i} style={{ marginTop: 8 }}>
                  <Text style={[styles.findingLine, { color: theme.text }]}>
                    {f.label} · {f.category.replace('_', ' ')} · {f.confidence}%
                  </Text>
                  <Text style={[styles.findingDesc, { color: theme.textSecondary }]}>{f.description}</Text>
                </View>
              ))}
              <Text style={[styles.summary, { color: theme.textSecondary }]}>{result.summary}</Text>
              <View style={styles.cardButtons}>
                <SmoothPressable onPress={dismissPopup} hitSlop={8}>
                  <Text style={[styles.cardButton, { color: theme.textSecondary }]}>Dismiss</Text>
                </SmoothPressable>
                <SmoothPressable
                  onPress={() => router.push(`/detections/${result.detectionId}`)}
                  hitSlop={8}
                >
                  <Text style={[styles.cardButton, { color: theme.tint }]}>View in Maalam</Text>
                </SmoothPressable>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <Button label="Simulate scan" variant="secondary" onPress={simulateScan} />
        <Button label="Simulate defect detection" onPress={() => void simulateDetection()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 12 },
  topNav: {
    width: FRAME_W,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  topNavTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  frame: {
    width: FRAME_W,
    height: FRAME_H,
    borderWidth: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0C0D12',
  },
  appHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2D35',
    backgroundColor: '#161720',
  },
  appTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  callBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(235, 75, 75, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  callDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5484D',
  },
  callDuration: {
    color: '#FF8885',
    fontSize: 11,
    fontWeight: '700',
  },
  videoCallBody: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  callerVideoBox: {
    flex: 1,
    backgroundColor: '#1C1D26',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  faceScanHud: {
    width: 170,
    height: 190,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 8,
  },
  hudCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 16,
    height: 16,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#00AC47',
  },
  hudCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#00AC47',
  },
  hudCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 16,
    height: 16,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#00AC47',
  },
  hudCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#00AC47',
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 8,
    textAlign: 'center',
  },
  callerTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  callerName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  callerSub: {
    color: '#9A9AA3',
    fontSize: 10,
  },
  callControlsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 14,
  },
  controlCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2C38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallCircle: {
    backgroundColor: '#E5484D',
    transform: [{ rotate: '135deg' }],
  },
  post: { padding: 12, gap: 8 },
  postImage: {
    height: 220,
    borderRadius: 12,
    backgroundColor: '#E9E9EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCaption: { fontSize: 14, color: '#FFFFFF' },
  alertBar: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    maxWidth: 290,
    backgroundColor: '#C62828',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 13,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    elevation: 8,
    zIndex: 99,
  },
  alertTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 3,
    elevation: 6,
    zIndex: 90,
  },
  pillTap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: ALERT_RED,
  },
  shutterFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    zIndex: 98,
  },
  toolsBar: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 10,
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    elevation: 10,
    zIndex: 95,
  },
  appHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerSide: {
    flex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  linkChain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  linkConnector: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkDot: {
    position: 'absolute',
    left: 2,
    top: 10,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  appLogoBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
  },
  maalamLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  maalamBadgeDot: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  closeBtn: {
    padding: 5,
    borderRadius: 14,
  },
  motionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    borderWidth: 1,
  },
  motionBannerText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  modeToggleWrap: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  modeToggle: {
    width: 208,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modeKnob: {
    position: 'absolute',
    left: 5,
    top: 5,
    bottom: 5,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  modeToggleLabel: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  verdictMini: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  verdictMiniTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  verdictMiniLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  verdictMiniSummary: {
    fontSize: 13,
    lineHeight: 18,
  },
  verdictMiniActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: 8,
  },
  verdictMiniBtn: {
    fontSize: 14,
    fontWeight: '700',
  },
  modeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  modeHintText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  screenshotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
    borderWidth: 1,
  },
  screenshotChipText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
  },
  chatScroll: {
    maxHeight: 220,
    marginBottom: 10,
  },
  chatThread: {
    gap: 6,
  },
  chatRow: {
    flexDirection: 'row',
  },
  chatRowEnd: {
    justifyContent: 'flex-end',
  },
  chatBubble: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
    maxWidth: '86%',
  },
  chatImage: {
    width: 180,
    height: 96,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  chatVerdict: {
    flex: 1,
    marginBottom: 0,
  },
  chipRow: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  chipText: { fontSize: 12.5, fontWeight: '600' },
  chipTextAccent: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 4,
  },
  plusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  toolsInput: {
    flex: 1,
    maxHeight: 90,
    paddingVertical: 6,
    marginRight: 8,
    fontSize: 14,
    lineHeight: 19,
  },
  toolsSend: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monitorStatus: { position: 'absolute', bottom: 10, right: 0, textAlign: 'center', fontSize: 11 },
  popupWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 100,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    width: '100%',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdictBadge: {
    backgroundColor: '#C62828',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verdictBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  cardTitle: { fontSize: 18, fontWeight: '700', marginTop: 9 },
  cardApp: { fontSize: 13, marginTop: 3 },
  cardSubtitle: { fontSize: 13 },
  findingLine: { fontSize: 14.5, fontWeight: '700' },
  findingDesc: { fontSize: 13.5, marginTop: 1 },
  summary: { fontSize: 13.5, marginTop: 10, lineHeight: 18 },
  cardButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: 14,
  },
  cardButton: { fontSize: 15, fontWeight: '700' },
  controls: { flexDirection: 'row', gap: 12 },
});
