// Attachments: images picked from the gallery and voice recordings, copied
// into the app's private storage and sent to the cloud provider as base64.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { newId } from '@/db/client';

const attachmentsDir = () => `${FileSystem.documentDirectory}attachments/`;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp3: 'audio/mp3',
};

function mimeOf(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'image/jpeg';
}

function extOf(mimeType?: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

async function copyIntoAttachments(
  from: string,
  ext: string
): Promise<string> {
  const dest = `${attachmentsDir()}${newId()}.${ext}`;
  await FileSystem.makeDirectoryAsync(attachmentsDir(), {
    intermediates: true,
  }).catch(() => {});
  await FileSystem.copyAsync({ from, to: dest });
  return dest;
}

/**
 * Pick one image from the gallery and copy it into private storage.
 * Returns the stored file's URI, or null if the user cancelled.
 */
export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return copyIntoAttachments(asset.uri, extOf(asset.mimeType));
}

/**
 * Move a finished voice recording into private storage. Recordings are AAC,
 * but the source extension is kept if it differs.
 */
export async function saveRecording(tmpUri: string): Promise<string> {
  const ext = tmpUri.split('.').pop()?.toLowerCase() || 'aac';
  return copyIntoAttachments(tmpUri, ext);
}

/** Read a stored attachment as base64 for a Gemini inlineData part. */
export async function readAttachmentBase64(
  uri: string
): Promise<{ mimeType: string; data: string }> {
  const data = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { mimeType: mimeOf(uri), data };
}

/** Remove every stored attachment (chat cleared, data reset, restore). */
export async function deleteAllAttachments(): Promise<void> {
  await FileSystem.deleteAsync(attachmentsDir(), { idempotent: true });
}
