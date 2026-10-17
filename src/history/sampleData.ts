import type { Detection } from '@/db/detections';
import type { Scan, ScanKind, ScanVerdict } from '@/db/scans';

const DAYS = [
  { minutes: 28, alert: ['Instagram', 'ai_generated', 89, 'A sample AI-generated post was flagged.'] as const, scans: [['image', 'safe', 97, 'Looks safe']] as const },
  { minutes: 54, alert: ['TikTok', 'deepfake', 94, 'A sample video showed signs of face manipulation.'] as const, scans: [['video', 'deepfake', 91, 'Possible face manipulation']] as const },
  { minutes: 36, alert: null, scans: [['text', 'safe', 98, 'Looks safe']] as const },
  { minutes: 67, alert: ['YouTube', 'harmful', 86, 'A sample post contained harmful language.'] as const, scans: [['audio', 'harmful', 82, 'Harmful language detected']] as const },
  { minutes: 42, alert: null, scans: [['image', 'safe', 96, 'Looks safe'], ['video', 'ai_generated', 78, 'Possible AI-generated media']] as const },
  { minutes: 73, alert: ['Facebook', 'ai_generated', 92, 'A sample image may be AI-generated.'] as const, scans: [['text', 'safe', 99, 'Looks safe']] as const },
  { minutes: 39, alert: ['Instagram', 'harmful', 84, 'A sample post was flagged for harmful content.'] as const, scans: [['image', 'safe', 97, 'Looks safe']] as const },
] as const;

function atTime(dayStart: number, time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(dayStart);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

/** Builds a repeatable, in-memory preview for the currently selected seven-day range. */
export function makeSampleHistory(starts: number[]): { detections: Detection[]; scans: Scan[]; usageMs: number[] } {
  const detections: Detection[] = [];
  const scans: Scan[] = [];
  const usageMs: number[] = [];

  DAYS.forEach((sampleDay, index) => {
    const dayStart = starts[index];
    if (dayStart === undefined) return;
    usageMs.push(sampleDay.minutes * 60_000);

    if (sampleDay.alert) {
      const [appLabel, verdict, confidence, summary] = sampleDay.alert;
      detections.push({
        id: `sample-alert-${dayStart}`,
        packageName: appLabel === 'YouTube' ? 'com.google.android.youtube' : `com.${appLabel.toLowerCase()}.android`,
        appLabel,
        verdict,
        confidence,
        summary,
        findings: [],
        screenshotUri: null,
        screenText: null,
        provider: 'Sample data',
        createdAt: atTime(dayStart, '14:25'),
      });
    }

    sampleDay.scans.forEach(([kind, verdict, confidence, summary], scanIndex) => {
      scans.push({
        id: `sample-scan-${dayStart}-${scanIndex}`,
        kind: kind as ScanKind,
        mediaUri: null,
        text: 'Example content used to preview the History screen.',
        verdict: verdict as ScanVerdict,
        confidence,
        summary,
        findings: [],
        provider: 'Sample data',
        createdAt: atTime(dayStart, scanIndex === 0 ? '10:10' : '16:40'),
      });
    });
  });

  return { detections, scans, usageMs };
}
