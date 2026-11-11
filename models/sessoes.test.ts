// models/sessoes.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-sessoes.db');

describe('sessoes', () => {
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

  it('cria uma sessao e resolve a conta a partir do token', async () => {
    const { criarConta } = await import('./contas');
    const { criarSessao, resolverContaIdPorToken } = await import('./sessoes');
    const conta = criarConta({ email: 'e@b.com', senha: '12345678' });
    const token = criarSessao(conta.id);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    expect(resolverContaIdPorToken(token)).toBe(conta.id);
  });

  it('retorna undefined para token inexistente', async () => {
    const { resolverContaIdPorToken } = await import('./sessoes');
    expect(resolverContaIdPorToken('token-que-nao-existe')).toBeUndefined();
  });

  it('retorna undefined para sessao expirada', async () => {
    const { criarConta } = await import('./contas');
    const { criarSessao, resolverContaIdPorToken } = await import('./sessoes');
    const { getDb } = await import('./db');
    const conta = criarConta({ email: 'f@b.com', senha: '12345678' });
    const token = criarSessao(conta.id);
    getDb().prepare("UPDATE sessoes SET expira_em = datetime('now', '-1 hours') WHERE token = ?").run(token);
    expect(resolverContaIdPorToken(token)).toBeUndefined();
  });

  it('apagarSessao remove o token', async () => {
    const { criarConta } = await import('./contas');
    const { criarSessao, apagarSessao, resolverContaIdPorToken } = await import('./sessoes');
    const conta = criarConta({ email: 'g@b.com', senha: '12345678' });
    const token = criarSessao(conta.id);
    apagarSessao(token);
    expect(resolverContaIdPorToken(token)).toBeUndefined();
  });

  it('apagarSessoesDaConta remove todas as sessoes da conta', async () => {
    const { criarConta } = await import('./contas');
    const { criarSessao, apagarSessoesDaConta, resolverContaIdPorToken } = await import('./sessoes');
    const conta = criarConta({ email: 'gg@b.com', senha: '12345678' });
    const token1 = criarSessao(conta.id);
    const token2 = criarSessao(conta.id);
    apagarSessoesDaConta(conta.id);
    expect(resolverContaIdPorToken(token1)).toBeUndefined();
    expect(resolverContaIdPorToken(token2)).toBeUndefined();
  });
});
