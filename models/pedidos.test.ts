// models/pedidos.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-pedidos.db');

async function criarCasamentoComPresente(email: string, slug: string, nomePresente: string) {
  const { criarConta } = await import('./contas');
  const { criarCasamento } = await import('./casamentos');
  const { criarPresente } = await import('./presentes');
  const conta = criarConta({ email, senha: '12345678' });
  const casamento = criarCasamento({
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
  const presente = criarPresente({ casamentoId: casamento.id, nome: nomePresente, descricao: '', preco: 100, imagens: [] });
  return { casamento, presente };
}

describe('pedidos', () => {
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

  it('cria um pedido e marca o presente como reservado', async () => {
    const { presente } = await criarCasamentoComPresente('t@b.com', 'casal-t', 'Copos');
    const { criarPedido } = await import('./pedidos');
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Maria',
      mensagem: 'Parabens!',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });
    expect(pedido.status).toBe('aguardando_pagamento');
    const { buscarPorId } = await import('./presentes');
    expect(buscarPorId(presente.id)?.status).toBe('reservado');
  });

  it('marca um pedido como pago e o presente como pago', async () => {
    const { presente } = await criarCasamentoComPresente('u@b.com', 'casal-u', 'Panela');
    const { criarPedido, marcarComoPago, buscarPedidoPorId } = await import('./pedidos');
    const { buscarPorId } = await import('./presentes');
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Joao',
      mensagem: '',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });
    marcarComoPago(pedido.id);
    expect(buscarPedidoPorId(pedido.id)?.status).toBe('pago');
    expect(buscarPorId(presente.id)?.status).toBe('pago');
  });

  it('expira pedidos com mais de 1h e libera o presente', async () => {
    const { presente } = await criarCasamentoComPresente('v@b.com', 'casal-v', 'Ferro');
    const { criarPedido, expirarPedidosAntigos, buscarPedidoPorId } = await import('./pedidos');
    const { buscarPorId } = await import('./presentes');
    const { getDb } = await import('./db');
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Ana',
      mensagem: '',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    getDb().prepare('UPDATE pedidos SET criado_em = ? WHERE id = ?').run(duasHorasAtras, pedido.id);
    expirarPedidosAntigos();
    expect(buscarPedidoPorId(pedido.id)?.status).toBe('cancelado');
    expect(buscarPorId(presente.id)?.status).toBe('disponivel');
  });

  it('nao expira pedidos com menos de 1h', async () => {
    const { presente } = await criarCasamentoComPresente('w@b.com', 'casal-w', 'Aspirador');
    const { criarPedido, expirarPedidosAntigos, buscarPedidoPorId } = await import('./pedidos');
    const { buscarPorId } = await import('./presentes');
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Carlos',
      mensagem: '',
      pixCopiaCola: '00020126...',
      pixQrCodeDataUrl: 'data:image/png;base64,ZmFrZQ==',
    });
    expirarPedidosAntigos();
    expect(buscarPedidoPorId(pedido.id)?.status).toBe('aguardando_pagamento');
    expect(buscarPorId(presente.id)?.status).toBe('reservado');
  });

  it('marcarComoPago nao faz nada se o pedido nao existe', async () => {
    const { marcarComoPago } = await import('./pedidos');
    expect(() => marcarComoPago(99999)).not.toThrow();
  });

  it('listarPedidos so retorna pedidos do casamento pedido (isolamento multi-tenant)', async () => {
    const { casamento: casamentoA, presente: presenteA } = await criarCasamentoComPresente('x@b.com', 'casal-x', 'A');
    const { presente: presenteB } = await criarCasamentoComPresente('y@b.com', 'casal-y', 'B');
    const { criarPedido, listarPedidos } = await import('./pedidos');
    criarPedido({ presenteId: presenteA.id, nomeConvidado: 'G1', mensagem: '', pixCopiaCola: 'x', pixQrCodeDataUrl: 'x' });
    criarPedido({ presenteId: presenteB.id, nomeConvidado: 'G2', mensagem: '', pixCopiaCola: 'x', pixQrCodeDataUrl: 'x' });
    expect(listarPedidos(casamentoA.id)).toHaveLength(1);
    expect(listarPedidos(casamentoA.id)[0].nome_convidado).toBe('G1');
  });
});
