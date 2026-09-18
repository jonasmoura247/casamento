// controllers/casamentosController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-casamentos-controller.db');

describe('casamentosController', () => {
  beforeEach(() => {
    const g = globalThis as unknown as { __db?: { close: () => void } };
    if (g.__db) {
      g.__db.close();
      g.__db = undefined;
    }
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.env.DB_PATH = TEST_DB_PATH;
    vi.resetModules();
  });

  it('obterEstadoPublico retorna expirado=false e contador quando dentro do prazo', async () => {
    const { cadastrar } = await import('./authController');
    const { obterEstadoPublico } = await import('./casamentosController');
    cadastrar({
      email: 'aa@b.com', senha: '12345678', slug: 'ativo',
      nomeCasal: 'Ativo', dataCasamento: '2099-01-01', local: '', mensagem: '',
      pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
    });
    const estado = obterEstadoPublico('ativo');
    expect(estado?.expirado).toBe(false);
  });

  it('obterEstadoPublico retorna expirado=true um dia apos a data', async () => {
    const { cadastrar } = await import('./authController');
    const { obterEstadoPublico } = await import('./casamentosController');
    cadastrar({
      email: 'bb@b.com', senha: '12345678', slug: 'expirado',
      nomeCasal: 'Expirado', dataCasamento: '2020-01-01', local: '', mensagem: '',
      pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
    });
    const estado = obterEstadoPublico('expirado');
    expect(estado?.expirado).toBe(true);
  });

  it('obterEstadoPublico retorna undefined para slug inexistente', async () => {
    const { obterEstadoPublico } = await import('./casamentosController');
    expect(obterEstadoPublico('nao-existe')).toBeUndefined();
  });

  it('atualizarDados so altera o casamento da conta autenticada', async () => {
    const { cadastrar } = await import('./authController');
    const { atualizarDados } = await import('./casamentosController');
    const { buscarPorSlug } = await import('../models/casamentos');
    const { casamento } = cadastrar({
      email: 'cc@b.com', senha: '12345678', slug: 'meu-casal',
      nomeCasal: 'Meu Casal', dataCasamento: '2027-01-01', local: '', mensagem: '',
      pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
    });
    atualizarDados(casamento.id, { mensagem: 'Atualizado' });
    expect(buscarPorSlug('meu-casal')?.mensagem).toBe('Atualizado');
  });
});
