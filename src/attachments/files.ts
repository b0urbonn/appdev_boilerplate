// Attachments: images picked from the gallery and voice recordings, copied
// into the app's private storage and sent to the cloud provider as base64.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { newId } from '@/db/client';

const attachmentsDir = () => `${FileSystem.documentDirectory}attachments/`;
export const scansDir = () => `${FileSystem.documentDirectory}scans/`;

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  mkv: 'video/x-matroska',
};

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp3: 'audio/mp3',
};

export type AttachmentKind = 'image' | 'audio' | 'video';

function mimeOf(uri: string, kind?: AttachmentKind): string {
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  if (kind === 'video') return VIDEO_MIME_BY_EXT[ext] ?? 'video/mp4';
  return MIME_BY_EXT[ext] ?? (kind === 'audio' ? 'audio/aac' : 'image/jpeg');
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

/** Copy a picked or recorded file into scan storage (survives "Clear chat"). */
export async function copyIntoScans(from: string, id: string): Promise<string> {
  const ext = from.split('?')[0].split('.').pop()?.toLowerCase() || 'bin';
  const dest = `${scansDir()}${id}.${ext}`;
  await FileSystem.makeDirectoryAsync(scansDir(), { intermediates: true }).catch(() => {});
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

/** Pick a video clip; keeps the container extension. */
export async function pickVideo(): Promise<{ uri: string; name: string; size: number } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? asset.uri.split('/').pop() ?? 'video',
    size: asset.fileSize ?? 0,
  };
}

/** Pick an audio file from the file browser. */
export async function pickAudioFile(): Promise<{ uri: string; name: string; size: number } | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name, size: asset.size ?? 0 };
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
  uri: string,
  kind?: AttachmentKind
): Promise<{ mimeType: string; data: string }> {
  const data = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { mimeType: mimeOf(uri, kind), data };
}

/** Remove every stored attachment (chat cleared, data reset, restore). */
export async function deleteAllAttachments(): Promise<void> {
  await FileSystem.deleteAsync(attachmentsDir(), { idempotent: true });
}

/** Remove every stored scan media file (data reset). */
export async function deleteAllScanMedia(): Promise<void> {
  await FileSystem.deleteAsync(scansDir(), { idempotent: true });
}
