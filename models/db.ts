// models/db.ts
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const globalForDb = globalThis as unknown as { __db?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__db) return globalForDb.__db;

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'lista-presentes.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  globalForDb.__db = db;
  return db;
}
