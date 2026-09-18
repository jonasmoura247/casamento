// controllers/pedidosController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-pedidos-controller.db');

async function criarCasamentoComPresenteDisponivel(email = 'ee@b.com', slug = 'pedidos-teste') {
  const { cadastrar } = await import('./authController');
  const { criar: criarPresente } = await import('./presentesController');
  const { casamento } = cadastrar({
    email, senha: '12345678', slug,
    nomeCasal: 'Teste', dataCasamento: '2027-01-01', local: '', mensagem: '',
    pixKey: 'chave-teste', pixNomeRecebedor: 'FULANO', pixCidade: 'SAO PAULO',
  });
  const presente = criarPresente(casamento.id, { nome: 'Cafeteira', descricao: '', preco: 130, imagens: [] });
  return { casamento, presente };
}

describe('pedidosController', () => {
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

  it('criar gera pedido com pix a partir dos dados do casamento do presente', async () => {
    const { presente } = await criarCasamentoComPresenteDisponivel();
    const { criar } = await import('./pedidosController');
    const pedido = await criar({ presenteId: presente.id, nomeConvidado: 'Beatriz', mensagem: 'Felicidades!' });
    expect(pedido.status).toBe('aguardando_pagamento');
    expect(pedido.pix_copia_cola.length).toBeGreaterThan(0);
    expect(pedido.pix_qr_code_data_url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('criar lanca erro se o presente nao existe ou nao esta disponivel', async () => {
    const { criar } = await import('./pedidosController');
    await expect(criar({ presenteId: 9999, nomeConvidado: 'X', mensagem: '' })).rejects.toThrow(
      'presente indisponivel'
    );
  });

  it('buscarStatus retorna o pedido por id', async () => {
    const { presente } = await criarCasamentoComPresenteDisponivel();
    const { criar, buscarStatus } = await import('./pedidosController');
    const pedido = await criar({ presenteId: presente.id, nomeConvidado: 'X', mensagem: '' });
    expect(buscarStatus(pedido.id)?.status).toBe('aguardando_pagamento');
  });

  it('listar e marcarPago operam escopados ao casamento', async () => {
    const { casamento, presente } = await criarCasamentoComPresenteDisponivel();
    const { criar, listar, marcarPago } = await import('./pedidosController');
    const pedido = await criar({ presenteId: presente.id, nomeConvidado: 'X', mensagem: '' });
    expect(listar(casamento.id)).toHaveLength(1);
    marcarPago(casamento.id, pedido.id);
    expect(listar(casamento.id)[0].status).toBe('pago');
  });

  it('marcarPago lanca erro se o pedido pertence a outro casamento', async () => {
    const { presente: presenteA } = await criarCasamentoComPresenteDisponivel('a@b.com', 'casamento-a');
    const { casamento: casamentoB } = await criarCasamentoComPresenteDisponivel('b@b.com', 'casamento-b');
    const { criar, marcarPago } = await import('./pedidosController');
    const pedidoDeA = await criar({ presenteId: presenteA.id, nomeConvidado: 'X', mensagem: '' });
    expect(() => marcarPago(casamentoB.id, pedidoDeA.id)).toThrow('pedido nao encontrado');
  });

  it('marcarPago lanca erro se o pedido nao existe', async () => {
    const { casamento } = await criarCasamentoComPresenteDisponivel();
    const { marcarPago } = await import('./pedidosController');
    expect(() => marcarPago(casamento.id, 9999)).toThrow('pedido nao encontrado');
  });
});
