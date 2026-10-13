// Back up / restore the whole app state (chat + settings) as one JSON file.
// The Gemini API key is never included in a backup.
import * as DocumentPicker from 'expo-document-picker';
import { releaseLocalConversation } from '@/ai/local';
import { deleteAllAttachments } from '@/attachments/files';
import { getDb } from '@/db/client';
import type { Conversation } from '@/db/conversations';
import type { MessageRow } from '@/db/messages';
import { DEFAULT_SETTINGS, type Settings } from '@/settings/storage';
import { readFile, saveFile } from './file';

export const BACKUP_FORMAT = 'offline-ai-starter-backup';
export const BACKUP_VERSION = 1;

/** Settings saved in a backup. The API key is never included. */
type BackupSettings = Pick<
  Settings,
  'provider' | 'geminiModel' | 'localBackend' | 'systemPrompt' | 'nickname' | 'theme'
>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: number;
  settings: BackupSettings;
  conversations: Conversation[];
  messages: MessageRow[];
}

export async function exportBackup(settings: Settings): Promise<number> {
  const db = await getDb();
  const conversations = await db.getAllAsync<Conversation>(
    'SELECT * FROM conversations'
  );
  const messages = await db.getAllAsync<MessageRow>(
    'SELECT * FROM messages ORDER BY created_at'
  );
  const {
    provider, geminiModel, localBackend, systemPrompt, nickname, theme,
  } = settings;
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    settings: { provider, geminiModel, localBackend, systemPrompt, nickname, theme },
    conversations,
    messages,
  };
  const date = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  await saveFile(
    `offline-ai-backup-${date}.json`,
    JSON.stringify(backup, null, 2)
  );
  return messages.length;
}

/** Parse + validate backup JSON. Exported so it can be unit-tested. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid backup file.');
  }
  const b = data as BackupFile;
  if (b?.format !== BACKUP_FORMAT || typeof b.version !== 'number') {
    throw new Error('This is not a valid backup file.');
  }
  if (b.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app.');
  }
  if (
    !Array.isArray(b.conversations) ||
    !Array.isArray(b.messages) ||
    typeof b.settings !== 'object' ||
    b.settings === null
  ) {
    throw new Error('This is not a valid backup file.');
  }
  return b;
}

export async function pickBackup(): Promise<BackupFile | null> {
  // '*/*' because Android file managers often mislabel .json files.
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return parseBackup(await readFile(result.assets[0].uri));
}

type UpdateFn = <K extends keyof Settings>(
  key: K,
  value: Settings[K]
) => void;

export async function restoreBackup(
  backup: BackupFile,
  update: UpdateFn
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM messages');
    await db.runAsync('DELETE FROM conversations');
    for (const c of backup.conversations) {
      await db.runAsync(
        'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
        c.id,
        c.title,
        c.created_at,
        c.updated_at
      );
    }
    for (const m of backup.messages) {
      // A 'pending' message can never resume — store it as an error.
      const interrupted = m.status === 'pending';
      await db.runAsync(
        `INSERT INTO messages
           (id, conversation_id, role, content, status, error, provider, image_uri, audio_uri, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        m.id,
        m.conversation_id,
        m.role,
        m.content,
        interrupted ? 'error' : m.status,
        interrupted ? 'Generation interrupted.' : m.error,
        m.provider,
        // Attachments are not part of a backup; old backups lack the columns.
        null,
        null,
        m.created_at
      );
    }
  });

  // Image files are not backed up - drop any left over from before.
  await deleteAllAttachments();

  // The restored chat is 'main' — drop its in-memory engine conversation.
  await releaseLocalConversation('main');

  // Apply only keys that look sane for their type.
  const s = backup.settings;
  const is = <K extends keyof BackupSettings>(
    key: K,
    valid: (v: BackupSettings[K]) => boolean
  ) => typeof s[key] === typeof DEFAULT_SETTINGS[key] && valid(s[key]);
  if (is('provider', (v) => v === 'cloud' || v === 'local')) {
    update('provider', s.provider);
  }
  if (is('geminiModel', (v) => v.length > 0)) update('geminiModel', s.geminiModel);
  if (is('localBackend', (v) => v === 'cpu' || v === 'gpu')) {
    update('localBackend', s.localBackend);
  }
  if (is('systemPrompt', () => true)) update('systemPrompt', s.systemPrompt);
  if (is('nickname', () => true)) update('nickname', s.nickname);
  if (is('theme', (v) => v === 'light' || v === 'dark')) update('theme', s.theme);
}
