import { captureScreenOnce } from '@/monitor/native';

/** Android asks which app/display may be captured; sharing ends after one image. */
export async function captureScreen(): Promise<string> {
  const uri = await captureScreenOnce();
  if (!uri) throw new Error('Screen capture was cancelled. Choose the app or screen to capture, then confirm Android’s prompt.');
  return uri;
}
