// models/contas.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-contas.db');

describe('contas', () => {
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
    vi.resetModules();
  });

  it('cria uma conta com senha em hash, nunca em texto puro', async () => {
    const { criarConta, buscarContaPorId } = await import('./contas');
    const conta = criarConta({ email: 'a@b.com', senha: 'segredo123' });
    expect(conta.email).toBe('a@b.com');
    const salva = buscarContaPorId(conta.id);
    expect(salva?.senha_hash).not.toBe('segredo123');
    expect(salva?.senha_hash).toContain(':');
  });

  it('rejeita email duplicado', async () => {
    const { criarConta } = await import('./contas');
    criarConta({ email: 'dup@b.com', senha: 'x1234567' });
    expect(() => criarConta({ email: 'dup@b.com', senha: 'y1234567' })).toThrow();
  });

  it('verificarSenha retorna true para a senha correta e false para a errada', async () => {
    const { criarConta, verificarSenha } = await import('./contas');
    const conta = criarConta({ email: 'c@b.com', senha: 'correta12' });
    expect(verificarSenha(conta.senha_hash, 'correta12')).toBe(true);
    expect(verificarSenha(conta.senha_hash, 'errada123')).toBe(false);
  });

  it('buscarContaPorEmail encontra e retorna undefined se nao existir', async () => {
    const { criarConta, buscarContaPorEmail } = await import('./contas');
    criarConta({ email: 'd@b.com', senha: '12345678' });
    expect(buscarContaPorEmail('d@b.com')?.email).toBe('d@b.com');
    expect(buscarContaPorEmail('naoexiste@b.com')).toBeUndefined();
  });
});
