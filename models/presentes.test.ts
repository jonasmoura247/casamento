// models/presentes.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-presentes.db');

async function criarCasamentoDeTeste(email: string, slug: string) {
  const { criarConta } = await import('./contas');
  const { criarCasamento } = await import('./casamentos');
  const conta = criarConta({ email, senha: '12345678' });
  return criarCasamento({
    contaId: conta.id,
    slug,
    nomeCasal: 'Casal',
    dataCasamento: '2026-12-12',
    local: '',
    mensagem: '',
    pixKey: 'x',
    pixNomeRecebedor: 'X',
    pixCidade: 'X',
  });
}

describe('presentes', () => {
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

  it('cria e lista presentes disponiveis apenas do casamento pedido', async () => {
    const casamentoA = await criarCasamentoDeTeste('m@b.com', 'casal-a');
    const casamentoB = await criarCasamentoDeTeste('n@b.com', 'casal-b');
    const { criarPresente, listarDisponiveis } = await import('./presentes');
    criarPresente({ casamentoId: casamentoA.id, nome: 'Panela', descricao: '', preco: 100, imagens: [] });
    criarPresente({ casamentoId: casamentoB.id, nome: 'Liquidificador', descricao: '', preco: 200, imagens: [] });

    const disponiveisA = listarDisponiveis(casamentoA.id);
    expect(disponiveisA).toHaveLength(1);
    expect(disponiveisA[0].nome).toBe('Panela');
  });

  it('nao lista presentes reservados ou pagos', async () => {
    const casamento = await criarCasamentoDeTeste('o@b.com', 'casal-o');
    const { criarPresente, listarDisponiveis, atualizarStatus } = await import('./presentes');
    const p = criarPresente({ casamentoId: casamento.id, nome: 'X', descricao: '', preco: 1, imagens: [] });
    atualizarStatus(p.id, 'reservado');
    expect(listarDisponiveis(casamento.id)).toHaveLength(0);
  });

  it('atualiza e remove um presente', async () => {
    const casamento = await criarCasamentoDeTeste('p@b.com', 'casal-p');
    const { criarPresente, atualizarPresente, removerPresente, buscarPorId } = await import('./presentes');
    const p = criarPresente({ casamentoId: casamento.id, nome: 'Toalhas', descricao: '', preco: 100, imagens: [] });
    atualizarPresente(p.id, { preco: 120 });
    expect(buscarPorId(p.id)?.preco).toBe(120);
    removerPresente(p.id);
    expect(buscarPorId(p.id)).toBeUndefined();
  });

  it('atualizarPresente nao faz nada se o id nao existe', async () => {
    const { atualizarPresente } = await import('./presentes');
    expect(() => atualizarPresente(99999, { preco: 1 })).not.toThrow();
  });

  it('listarTodos so retorna presentes do casamento pedido (isolamento multi-tenant)', async () => {
    const casamentoA = await criarCasamentoDeTeste('q@b.com', 'casal-q');
    const casamentoB = await criarCasamentoDeTeste('r@b.com', 'casal-r');
    const { criarPresente, listarTodos } = await import('./presentes');
    criarPresente({ casamentoId: casamentoA.id, nome: 'A1', descricao: '', preco: 1, imagens: [] });
    criarPresente({ casamentoId: casamentoB.id, nome: 'B1', descricao: '', preco: 1, imagens: [] });
    criarPresente({ casamentoId: casamentoB.id, nome: 'B2', descricao: '', preco: 1, imagens: [] });

    expect(listarTodos(casamentoA.id)).toHaveLength(1);
    expect(listarTodos(casamentoB.id)).toHaveLength(2);
  });

  it('respeita o limite de 5 fotos', async () => {
    const casamento = await criarCasamentoDeTeste('s@b.com', 'casal-s');
    const { criarPresente } = await import('./presentes');
    const p = criarPresente({
      casamentoId: casamento.id,
      nome: 'Muitas fotos',
      descricao: '',
      preco: 1,
      imagens: ['1', '2', '3', '4', '5', '6', '7'],
    });
    expect(p.imagens).toHaveLength(5);
  });
});
