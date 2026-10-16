import { getDb, newId } from './client';

export type MessageStatus = 'done' | 'pending' | 'error';

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  status: MessageStatus;
  error: string | null;
  provider: string | null;
  /** Local file URI of an attached image, if any. */
  image_uri: string | null;
  /** Local file URI of a voice-message recording, if any. */
  audio_uri: string | null;
  created_at: number;
}

export async function listMessages(
  conversationId: string
): Promise<MessageRow[]> {
  const db = await getDb();
  return db.getAllAsync<MessageRow>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    conversationId
  );
}

export async function insertMessage(
  message: Omit<MessageRow, 'id' | 'created_at'>
): Promise<MessageRow> {
  const db = await getDb();
  const row: MessageRow = {
    ...message,
    id: newId(),
    created_at: Date.now(),
  };
  await db.runAsync(
    `INSERT INTO messages
       (id, conversation_id, role, content, status, error, provider, image_uri, audio_uri, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.conversation_id,
    row.role,
    row.content,
    row.status,
    row.error,
    row.provider,
    row.image_uri,
    row.audio_uri,
    row.created_at
  );
  return row;
}

export async function updateMessageContent(
  id: string,
  content: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE messages SET content = ? WHERE id = ?', content, id);
}

export async function setMessageStatus(
  id: string,
  status: MessageStatus,
  error: string | null = null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE messages SET status = ?, error = ? WHERE id = ?',
    status,
    error,
    id
  );
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM messages WHERE id = ?', id);
}

export interface ManualScan {
  id: string;
  type: 'image' | 'voice' | 'text';
  title: string;
  subtitle: string;
  createdAt: number;
}

/** Strip markdown emphasis/heading markers for a one-line preview. */
function plainLine(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').replace(/[*_`~]/g, '').trim())
    .find((l) => l.length > 0) ?? '';
}

/**
 * Manual scans from the chatbot: each done assistant reply in the main
 * conversation, paired with the user message that prompted it.
 */
export async function listManualScans(conversationId = 'main'): Promise<ManualScan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT * FROM messages
     WHERE conversation_id = ? AND role = 'assistant' AND status = 'done'
     ORDER BY created_at DESC`,
    conversationId
  );
  const scans: ManualScan[] = [];
  for (const reply of rows) {
    const prompt = await db.getFirstAsync<MessageRow>(
      `SELECT * FROM messages
       WHERE conversation_id = ? AND role = 'user' AND created_at < ?
       ORDER BY created_at DESC LIMIT 1`,
      conversationId,
      reply.created_at
    );
    if (!prompt) continue;
    const type: ManualScan['type'] = prompt.image_uri ? 'image' : prompt.audio_uri ? 'voice' : 'text';
    const title = prompt.content.trim().slice(0, 60)
      || (type === 'image' ? 'Image scan' : type === 'voice' ? 'Voice clip' : 'Text check');
    scans.push({
      id: reply.id,
      type,
      title,
      subtitle: plainLine(reply.content).slice(0, 80),
      createdAt: reply.created_at,
    });
  }
  return scans;
}
