// Web stand-in for files.ts: expo-file-system is native-only, so web
// attachments are stored as data URLs. They persist in SQLite across
// reloads, unlike blob: URLs.
import * as ImagePicker from 'expo-image-picker';

/** Read any fetchable URI into a base64 data URL. */
async function toDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Pick one image from the browser's file chooser.
 * Returns a data URL, or null if the user cancelled.
 */
export type AttachmentKind = 'image' | 'audio' | 'video';

/** Pick a video clip through the browser's file chooser. */
export async function pickVideo(): Promise<{ uri: string; name: string; size: number } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return {
    uri: await toDataUrl(asset.uri),
    name: asset.fileName ?? 'video',
    size: asset.fileSize ?? 0,
  };
}

/** Pick an audio file through the browser's file chooser. */
export async function pickAudioFile(): Promise<{ uri: string; name: string; size: number } | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return {
    uri: await toDataUrl(asset.uri),
    name: asset.name ?? 'audio',
    size: asset.size ?? 0,
  };
}

/** Scan media is a data URL; the id is ignored on web. */
export async function copyIntoScans(from: string, _id: string): Promise<string> {
  return from;
}

export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return toDataUrl(result.assets[0].uri);
}

/**
 * Store a finished voice recording as a data URL. Keeps the browser's
 * real mime type (audio/webm, audio/ogg...), which Gemini accepts.
 */
export async function saveRecording(tmpUri: string): Promise<string> {
  return toDataUrl(tmpUri);
}

/** Parse a stored data URL back into mime + base64 for a Gemini inlineData part. */
export async function readAttachmentBase64(
  uri: string
): Promise<{ mimeType: string; data: string }> {
  const match = /^data:([^;,]+)(?:;[^;,]*)*;base64,([\s\S]*)$/.exec(uri);
  if (!match) {
    throw new Error('Attachment is not a base64 data URL.');
  }
  return { mimeType: match[1], data: match[2] };
}

/** Nothing to clean up on web - attachments live inside the database rows. */
export async function deleteAllAttachments(): Promise<void> {}

export async function deleteAllScanMedia(): Promise<void> {}
