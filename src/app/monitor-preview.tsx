// Web/preview surface that mirrors the Android MaalamMonitorService overlay:
// draggable bubble, alert bar and detection popup over a fake app feed.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
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

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [barVisible, setBarVisible] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);

  const [pos] = useState(() => new Animated.ValueXY({ x: FRAME_W - BUBBLE - 8, y: 200 }));
  const [pulse] = useState(() => new Animated.Value(1));
  const barTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draggable bubble; snap to the nearest frame edge on release.
  // Stable mutable box for the drag origin (not a ref: handlers only).
  const [drag] = useState(() => ({ x: 0, y: 0 }));
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
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
        pos.stopAnimation((v) => { drag.x = v.x; drag.y = v.y; });
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
    return () => { animation.stop(); pulse.setValue(1); };
  }, [scanning, reduceMotion, pulse]);

  useEffect(() => () => { if (barTimer.current) clearTimeout(barTimer.current); }, []);

  const simulateScan = () => {
    setScanning(true);
    setTimeout(() => setScanning(false), 1500);
  };

  const simulateDetection = async () => {
    setScanning(true);
    const detectionId = newId();
    const demo: DemoResult = {
      detectionId,
      verdict: 'deepfake',
      confidence: 87,
      summary:
        'The face in this video shows face-swap blending artifacts and the caption pushes a false claim. Treat this clip as likely AI-manipulated.',
      findings: [
        { category: 'deepfake', label: 'Face-swap artifacts', confidence: 87, description: 'Blurred edges and inconsistent lighting around the face suggest a swapped face.' },
        { category: 'ai_generated', label: 'AI-generated background', confidence: 72, description: 'The background contains warped text and repeating patterns typical of generated imagery.' },
        { category: 'harmful', label: 'Misleading caption', confidence: 64, description: 'The caption presents a fabricated clip as a real leaked video.' },
      ],
    };
    try {
      await insertDetection({
        id: detectionId,
        packageName: 'com.zhiliaoapp.musically',
        appLabel: 'TikTok',
        verdict: 'deepfake',
        confidence: 87,
        summary: demo.summary,
        findings: demo.findings,
        screenshotUri: null,
        screenText: DEMO_POSTS.map((p) => p.caption).join('\n'),
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
  };

  const openPopup = () => result && setPopupVisible(true);
  const dismissPopup = () => {
    setPopupVisible(false);
    setResult(null);
  };

  const bubbleColor = result ? ALERT_RED : IDLE_BLUE;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Fake protected app */}
      <View style={[styles.frame, { borderColor: theme.border }]}>
        <View style={styles.appHeader}>
          <Text style={styles.appTitle}>TikTok</Text>
        </View>
        {DEMO_POSTS.map((post, i) => (
          <View key={i} style={styles.post}>
            <View style={styles.postImage}>
              <Ionicons name="image-outline" size={40} color="#9A9AA3" />
            </View>
            <Text style={styles.postCaption} numberOfLines={2}>{post.caption}</Text>
          </View>
        ))}

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
            accessibilityLabel="Maalam monitor"
            onPress={openPopup}
            style={styles.bubbleTap}
          >
            <Text style={styles.bubbleGlyph}>🛡</Text>
          </SmoothPressable>
        </Animated.View>

        {/* Popup */}
        {popupVisible && result && (
          // Scrim and card are siblings so no pressable contains another.
          <View style={styles.popupWrap} pointerEvents="box-none">
            <SmoothPressable
              style={styles.scrim}
              onPress={dismissPopup}
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
            />
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Deepfake, AI-generated or harmful content detected
              </Text>
              <Text style={styles.cardSubtitle}>
                TikTok · {result.confidence}% confidence
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
        <Button label="Simulate detection" onPress={() => void simulateDetection()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', paddingVertical: 24, gap: 16 },
  frame: {
    width: FRAME_W,
    height: FRAME_H,
    borderWidth: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  appHeader: {
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  appTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  post: { padding: 12, gap: 8 },
  postImage: {
    height: 220,
    borderRadius: 12,
    backgroundColor: '#E9E9EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCaption: { fontSize: 14, color: '#333' },
  alertBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: ALERT_RED,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  alertText: { color: '#FFFFFF', fontSize: 14 },
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
