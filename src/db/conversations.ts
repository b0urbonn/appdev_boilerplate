import { deleteAllAttachments } from '@/attachments/files';
import { getDb } from './client';

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

/** Create the conversation row if it doesn't exist yet. */
export async function ensureConversation(id: string, title = 'Chat'): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    'INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    id,
    title,
    now,
    now
  );
}

/** Record when the conversation was last used. */
export async function touchConversation(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE conversations SET updated_at = ? WHERE id = ?',
    Date.now(),
    id
  );
}

export async function clearAllConversations(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM messages');
  await db.runAsync('DELETE FROM conversations');
  await deleteAllAttachments();
}
