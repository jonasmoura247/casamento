// models/casamentos.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-casamentos.db');

const DADOS_BASE = {
  slug: 'jonasenatalia',
  nomeCasal: 'Jonas & Natália',
  dataCasamento: '2026-12-12',
  local: 'Sitio Boa Vista',
  mensagem: 'Com carinho',
  pixKey: 'chave-pix',
  pixNomeRecebedor: 'JONAS',
  pixCidade: 'SAO PAULO',
};

describe('casamentos', () => {
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

  it('valida slug: aceita minusculas/numeros/hifen entre 3 e 50 chars', async () => {
    const { slugValido } = await import('./casamentos');
    expect(slugValido('jonasenatalia')).toBe(true);
    expect(slugValido('joao-e-maria-2026')).toBe(true);
    expect(slugValido('ab')).toBe(false);
    expect(slugValido('Com Espaco')).toBe(false);
    expect(slugValido('a'.repeat(51))).toBe(false);
  });

  it('normalizarSlug faz lowercase e troca espacos por hifen', async () => {
    const { normalizarSlug } = await import('./casamentos');
    expect(normalizarSlug('Jonas E Natalia')).toBe('jonas-e-natalia');
  });

  it('cria um casamento vinculado a uma conta e busca por slug', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento, buscarPorSlug } = await import('./casamentos');
    const conta = criarConta({ email: 'h@b.com', senha: '12345678' });
    const casamento = criarCasamento({ contaId: conta.id, ...DADOS_BASE });
    expect(casamento.slug).toBe('jonasenatalia');
    expect(buscarPorSlug('jonasenatalia')?.nome_casal).toBe('Jonas & Natália');
  });

  it('rejeita slug duplicado', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento } = await import('./casamentos');
    const c1 = criarConta({ email: 'i@b.com', senha: '12345678' });
    const c2 = criarConta({ email: 'j@b.com', senha: '12345678' });
    criarCasamento({ contaId: c1.id, ...DADOS_BASE });
    expect(() => criarCasamento({ contaId: c2.id, ...DADOS_BASE })).toThrow();
  });

  it('buscarPorContaId encontra o casamento da conta', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento, buscarPorContaId } = await import('./casamentos');
    const conta = criarConta({ email: 'k@b.com', senha: '12345678' });
    criarCasamento({ contaId: conta.id, ...DADOS_BASE });
    expect(buscarPorContaId(conta.id)?.slug).toBe('jonasenatalia');
  });

  it('atualizarCasamento atualiza os campos editaveis', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento, atualizarCasamento, buscarPorSlug } = await import('./casamentos');
    const conta = criarConta({ email: 'l@b.com', senha: '12345678' });
    const casamento = criarCasamento({ contaId: conta.id, ...DADOS_BASE });
    atualizarCasamento(casamento.id, { mensagem: 'Nova mensagem', mostrarContador: false });
    const atualizado = buscarPorSlug('jonasenatalia')!;
    expect(atualizado.mensagem).toBe('Nova mensagem');
    expect(atualizado.mostrar_contador).toBe(0);
  });

  it('atualizarCasamento nao faz nada se o id nao existe', async () => {
    const { atualizarCasamento } = await import('./casamentos');
    expect(() => atualizarCasamento(99999, { mensagem: 'x' })).not.toThrow();
  });

  it('atualizarCasamento aceita mostrarContador true', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento, atualizarCasamento, buscarPorSlug } = await import('./casamentos');
    const conta = criarConta({ email: 'mm@b.com', senha: '12345678' });
    const casamento = criarCasamento({ contaId: conta.id, ...DADOS_BASE });
    atualizarCasamento(casamento.id, { mostrarContador: true });
    expect(buscarPorSlug('jonasenatalia')!.mostrar_contador).toBe(1);
  });

  it('atualizarCasamento mantem mensagem e mostrar_contador quando omitidos', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento, atualizarCasamento, buscarPorSlug } = await import('./casamentos');
    const conta = criarConta({ email: 'll@b.com', senha: '12345678' });
    const casamento = criarCasamento({ contaId: conta.id, ...DADOS_BASE });
    atualizarCasamento(casamento.id, { nomeCasal: 'Outro Nome' });
    const atualizado = buscarPorSlug('jonasenatalia')!;
    expect(atualizado.nome_casal).toBe('Outro Nome');
    expect(atualizado.mensagem).toBe(DADOS_BASE.mensagem);
    expect(atualizado.mostrar_contador).toBe(casamento.mostrar_contador);
  });

  it('calcularCorteExpiracao retorna inicio do dia seguinte a data do casamento', async () => {
    const { calcularCorteExpiracao } = await import('./casamentos');
    const corte = calcularCorteExpiracao('2026-12-12');
    expect(corte.toISOString()).toBe('2026-12-13T00:00:00.000Z');
  });

  it('estaExpirado compara agora contra o corte', async () => {
    const { estaExpirado } = await import('./casamentos');
    expect(estaExpirado('2020-01-01', new Date('2020-01-05'))).toBe(true);
    expect(estaExpirado('2030-01-01', new Date('2020-01-05'))).toBe(false);
  });

  it('removerCasamento apaga o registro', async () => {
    const { criarConta } = await import('./contas');
    const { criarCasamento, removerCasamento, buscarPorSlug } = await import('./casamentos');
    const conta = criarConta({ email: 'nn@b.com', senha: '12345678' });
    const casamento = criarCasamento({ contaId: conta.id, ...DADOS_BASE });
    removerCasamento(casamento.id);
    expect(buscarPorSlug('jonasenatalia')).toBeUndefined();
  });
});
