import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Ordered migrations, applied by PRAGMA user_version. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'pending', 'error')),
    error TEXT,
    provider TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages (conversation_id, created_at);
  `,
  `
  ALTER TABLE messages ADD COLUMN image_uri TEXT;
  `,
  `
  ALTER TABLE messages ADD COLUMN audio_uri TEXT;
  `,
  `
  CREATE TABLE IF NOT EXISTS detections (
    id TEXT PRIMARY KEY,
    package_name TEXT NOT NULL,
    app_label TEXT NOT NULL,
    verdict TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    summary TEXT NOT NULL,
    findings TEXT NOT NULL,
    screenshot_uri TEXT,
    screen_text TEXT,
    provider TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_detections_created
    ON detections (created_at);
  `,
  `
  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    media_uri TEXT,
    text TEXT,
    verdict TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    summary TEXT NOT NULL,
    findings TEXT NOT NULL,
    provider TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_scans_created
    ON scans (created_at);
  `,
];

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i++) {
    await database.execAsync(MIGRATIONS[i]);
    await database.execAsync(`PRAGMA user_version = ${i + 1}`);
  }
}

/** Open (and migrate) the database. Safe to call from anywhere; runs once. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return Promise.resolve(db);
  if (!initPromise) {
    initPromise = (async () => {
      const database = await SQLite.openDatabaseAsync('chat.db');
      await database.execAsync('PRAGMA foreign_keys = ON');
      await migrate(database);
      db = database;
      return database;
    })();
  }
  return initPromise;
}
