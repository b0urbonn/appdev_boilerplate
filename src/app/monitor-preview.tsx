// Web/preview surface that mirrors the Android MaalamMonitorService overlay:
// draggable bubble, alert bar and detection popup over a fake app feed or live video call.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { QuickChatPanel } from '@/components/QuickChatPanel';
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
const BUBBLE = 56;

const IDLE_BLUE = '#208AEF';
const ALERT_RED = '#E5484D';

const DEMO_POSTS = [
  { caption: 'POV: the celebrity "leaked" video everyone is sharing' },
  { caption: 'This face-swap filter is getting scary good…' },
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
  const [chatVisible, setChatVisible] = useState(false);

  const [pos] = useState(() => new Animated.ValueXY({ x: FRAME_W - BUBBLE - 8, y: 200 }));
  const [pulse] = useState(() => new Animated.Value(1));
  const barTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draggable bubble; snap to the nearest frame edge on release.
  const [drag] = useState(() => ({ x: 0, y: 0 }));
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
      onPanResponderMove: (_, g) => {
        pos.setValue({
          x: Math.max(0, Math.min(FRAME_W - BUBBLE, drag.x + g.dx)),
          y: Math.max(0, Math.min(FRAME_H - BUBBLE, drag.y + g.dy)),
        });
      },
      onPanResponderRelease: () => {
        pos.stopAnimation((v) => {
          const x = v.x + BUBBLE / 2 < FRAME_W / 2 ? 0 : FRAME_W - BUBBLE;
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
      barTimer.current = setTimeout(() => setBarVisible(false), 8000);
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

  const openPopup = () => result && setPopupVisible(true);
  const dismissPopup = () => {
    setPopupVisible(false);
    setResult(null);
  };

  const bubbleColor = scanning ? '#7C3AED' : result ? ALERT_RED : IDLE_BLUE;

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

      <QuickChatPanel visible={chatVisible} onClose={() => setChatVisible(false)} />

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

        {/* Alert bar */}
        {barVisible && (
          <SmoothPressable style={styles.alertBar} onPress={openPopup}>
            <Text style={styles.alertText}>
              ⚠ Potential {result?.verdict.replace('_', ' ')} detected · Tap to view
            </Text>
          </SmoothPressable>
        )}

        {/* Floating bubble */}
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleColor,
              opacity: scanning ? pulse : 1,
              transform: pos.getTranslateTransform(),
            },
          ]}
        >
          <SmoothPressable
            accessibilityRole="button"
            accessibilityLabel={`Maalam ${
              scanning ? 'scanning' : result ? 'content flagged' : 'running'
            }. Open chat`}
            onPress={() => setChatVisible(true)}
            style={styles.bubbleTap}
          >
            <Text style={styles.bubbleGlyph}>{scanning ? '⟳' : result ? '!' : '🛡'}</Text>
          </SmoothPressable>
        </Animated.View>

        <Text style={[styles.monitorStatus, { left: 0 }]} accessibilityLiveRegion="polite">
          {scanning
            ? 'Scanning live video stream…'
            : result
            ? 'Defect flagged · tap the alert to view'
            : 'Live call protection active · tap circle to chat'}
        </Text>

        {/* Popup */}
        {popupVisible && result && (
          <View style={styles.popupWrap} pointerEvents="box-none">
            <SmoothPressable
              style={styles.scrim}
              onPress={dismissPopup}
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
            />
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {isVideoCall
                  ? 'Deepfake or AI-manipulated video call detected'
                  : 'Deepfake, AI-generated or harmful content detected'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {appLabel} · {result.confidence}% confidence
              </Text>
              {result.findings.map((f, i) => (
                <View key={i} style={{ marginTop: 8 }}>
                  <Text style={styles.findingLine}>
                    {f.label} · {f.category.replace('_', ' ')} · {f.confidence}%
                  </Text>
                  <Text style={styles.findingDesc}>{f.description}</Text>
                </View>
              ))}
              <Text style={styles.summary}>{result.summary}</Text>
              <View style={styles.cardButtons}>
                <SmoothPressable onPress={dismissPopup} hitSlop={8}>
                  <Text style={styles.cardButton}>Dismiss</Text>
                </SmoothPressable>
                <SmoothPressable
                  onPress={() => router.push(`/detections/${result.detectionId}`)}
                  hitSlop={8}
                >
                  <Text style={styles.cardButton}>View in Maalam</Text>
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
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: ALERT_RED,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  alertText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  bubble: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  bubbleTap: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  bubbleGlyph: { fontSize: 26 },
  monitorStatus: { position: 'absolute', bottom: 12, right: 0, textAlign: 'center', fontSize: 12, color: '#A0B4C8' },
  popupWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#B42323' },
  cardSubtitle: { fontSize: 14, color: '#444', marginTop: 4 },
  findingLine: { fontSize: 14, fontWeight: '700', color: '#111' },
  findingDesc: { fontSize: 13, color: '#555' },
  summary: { fontSize: 13, color: '#444', marginTop: 10 },
  cardButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
    marginTop: 16,
  },
  cardButton: { color: IDLE_BLUE, fontSize: 15, fontWeight: '700' },
  controls: { flexDirection: 'row', gap: 12 },
});
