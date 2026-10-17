import * as FileSystem from 'expo-file-system/legacy';
import { newId } from '@/db/client';

export async function temporaryMedia(base64: string, mime: string) {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
    'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
  };
  const ext = extensions[mime];
  if (!ext) throw new Error('This media format is not supported.');
  const dir = `${FileSystem.cacheDirectory}linked-media/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const uri = `${dir}${newId()}.${ext}`;
  try {
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    throw error;
  }
  return { uri, dispose: () => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}) };
}
