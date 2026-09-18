// models/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-db.db');

describe('getDb', () => {
  beforeEach(() => {
    // ponytail: close stale cached connection first — Windows locks the file
    // handle, so unlinking a still-open db.ts globalThis.__db throws EBUSY.
    const g = globalThis as unknown as { __db?: { close: () => void } };
    if (g.__db) {
      g.__db.close();
      g.__db = undefined;
    }
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
  });

  it('cria todas as tabelas do schema multi-tenant', async () => {
    const { getDb } = await import('./db');
    const db = getDb();
    const tabelas = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name);
    expect(tabelas).toEqual(
      expect.arrayContaining(['contas', 'sessoes', 'casamentos', 'presentes', 'pedidos'])
    );
  });

  it('usa lista-presentes.db no diretorio do projeto quando DB_PATH nao esta definido', async () => {
    const DEFAULT_DB_PATH = path.join(process.cwd(), 'lista-presentes.db');
    delete process.env.DB_PATH;
    if (fs.existsSync(DEFAULT_DB_PATH)) fs.unlinkSync(DEFAULT_DB_PATH);
    const { getDb } = await import('./db');
    getDb();
    expect(fs.existsSync(DEFAULT_DB_PATH)).toBe(true);
    (globalThis as unknown as { __db?: { close: () => void } }).__db?.close();
    (globalThis as unknown as { __db?: unknown }).__db = undefined;
    fs.unlinkSync(DEFAULT_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
  });
});
