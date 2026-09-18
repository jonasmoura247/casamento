// controllers/presentesController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-presentes-controller.db');

async function criarCasamentoDeTeste(email: string, slug: string) {
  const { cadastrar } = await import('./authController');
  const { casamento } = cadastrar({
    email, senha: '12345678', slug,
    nomeCasal: 'Teste', dataCasamento: '2027-01-01', local: '', mensagem: '',
    pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
  });
  return casamento;
}

describe('presentesController', () => {
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

  it('criar/listar/atualizar/remover operam escopados ao casamentoId', async () => {
    const casamento = await criarCasamentoDeTeste('dd@b.com', 'presentes-teste');
    const { criar, listar, atualizar, remover } = await import('./presentesController');
    const presente = criar(casamento.id, { nome: 'Panela', descricao: '', preco: 100, imagens: [] });
    expect(listar(casamento.id)).toHaveLength(1);
    atualizar(casamento.id, presente.id, { preco: 150 });
    expect(listar(casamento.id)[0].preco).toBe(150);
    remover(casamento.id, presente.id);
    expect(listar(casamento.id)).toHaveLength(0);
  });

  it('atualizar/remover rejeitam presente de outro casamento', async () => {
    const casamentoA = await criarCasamentoDeTeste('ff@b.com', 'casal-ff');
    const casamentoB = await criarCasamentoDeTeste('gg@b.com', 'casal-gg');
    const { criar, atualizar, remover } = await import('./presentesController');
    const presenteDeA = criar(casamentoA.id, { nome: 'Panela', descricao: '', preco: 100, imagens: [] });
    expect(() => atualizar(casamentoB.id, presenteDeA.id, { preco: 1 })).toThrow('presente nao encontrado');
    expect(() => remover(casamentoB.id, presenteDeA.id)).toThrow('presente nao encontrado');
  });
});
