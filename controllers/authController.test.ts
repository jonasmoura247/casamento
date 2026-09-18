// controllers/authController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-auth-controller.db');

const DADOS_CADASTRO = {
  email: 'z@b.com',
  senha: '12345678',
  slug: 'novo-casal',
  nomeCasal: 'Novo Casal',
  dataCasamento: '2027-01-01',
  local: '',
  mensagem: '',
  pixKey: 'chave',
  pixNomeRecebedor: 'NOME',
  pixCidade: 'CIDADE',
};

describe('authController', () => {
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

  it('cadastrar cria conta + casamento e retorna um token de sessao', async () => {
    const { cadastrar } = await import('./authController');
    const resultado = cadastrar(DADOS_CADASTRO);
    expect(resultado.token).toBeTruthy();
    expect(resultado.casamento.slug).toBe('novo-casal');
  });

  it('cadastrar rejeita slug invalido', async () => {
    const { cadastrar } = await import('./authController');
    expect(() => cadastrar({ ...DADOS_CADASTRO, slug: 'ab' })).toThrow('Link inválido');
  });

  it('cadastrar rejeita email ja cadastrado', async () => {
    const { cadastrar } = await import('./authController');
    cadastrar(DADOS_CADASTRO);
    expect(() => cadastrar({ ...DADOS_CADASTRO, slug: 'outro-slug' })).toThrow('E-mail já cadastrado');
  });

  it('cadastrar rejeita slug ja em uso', async () => {
    const { cadastrar } = await import('./authController');
    cadastrar(DADOS_CADASTRO);
    expect(() => cadastrar({ ...DADOS_CADASTRO, email: 'outro@b.com' })).toThrow('Esse link já está em uso');
  });

  it('login com credenciais corretas retorna token', async () => {
    const { cadastrar, login } = await import('./authController');
    cadastrar(DADOS_CADASTRO);
    const resultado = login({ email: DADOS_CADASTRO.email, senha: DADOS_CADASTRO.senha });
    expect(resultado.token).toBeTruthy();
  });

  it('login com senha errada lanca erro', async () => {
    const { cadastrar, login } = await import('./authController');
    cadastrar(DADOS_CADASTRO);
    expect(() => login({ email: DADOS_CADASTRO.email, senha: 'errada' })).toThrow('E-mail ou senha incorretos');
  });

  it('login com email inexistente lanca erro', async () => {
    const { login } = await import('./authController');
    expect(() => login({ email: 'ninguem@b.com', senha: 'x' })).toThrow('E-mail ou senha incorretos');
  });

  it('cadastrar envolve erro inesperado de criarConta como email ja cadastrado', async () => {
    vi.doMock('../models/contas', () => ({
      buscarContaPorEmail: () => undefined,
      criarConta: () => {
        throw new Error('erro de banco inesperado');
      },
      verificarSenha: () => false,
    }));
    const { cadastrar } = await import('./authController');
    expect(() => cadastrar(DADOS_CADASTRO)).toThrow('E-mail já cadastrado');
    vi.doUnmock('../models/contas');
  });

  it('logout apaga a sessao', async () => {
    const { cadastrar, logout } = await import('./authController');
    const { resolverContaIdPorToken } = await import('../models/sessoes');
    const { token } = cadastrar(DADOS_CADASTRO);
    logout(token);
    expect(resolverContaIdPorToken(token)).toBeUndefined();
  });
});
