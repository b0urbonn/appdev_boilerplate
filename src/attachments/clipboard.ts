import { readClipboardText as readNativeClipboard } from '@/monitor/native';

export async function readClipboardText(): Promise<string> {
  const text = await readNativeClipboard();
  if (!text.trim()) throw new Error('No text was found. Copy the post link first, then tap Paste link.');
  return text.slice(0, 5000);
}
