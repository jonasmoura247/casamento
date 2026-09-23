// app/api/pedidos/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-api-pedidos.db');

async function criarPresenteDisponivel() {
  const { cadastrar } = await import('@/controllers/authController');
  const { criar: criarPresente } = await import('@/controllers/presentesController');
  const { casamento } = cadastrar({
    email: 'hh@b.com', senha: '12345678', slug: 'api-pedidos-teste',
    nomeCasal: 'Teste', dataCasamento: '2027-01-01', local: '', mensagem: '',
    pixKey: 'chave-teste', pixNomeRecebedor: 'FULANO', pixCidade: 'SAO PAULO',
  });
  return criarPresente(casamento.id, { nome: 'Cafeteira', descricao: '', preco: 130, imagens: [] });
}

describe('POST /api/pedidos', () => {
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

  it('cria um pedido e retorna dados do pix', async () => {
    const presente = await criarPresenteDisponivel();
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ presenteId: presente.id, nomeConvidado: 'Beatriz', mensagem: 'Felicidades!' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.pedido.status).toBe('aguardando_pagamento');
    expect(body.pedido.pix_copia_cola.length).toBeGreaterThan(0);
    expect(body.pedido.pix_qr_code_data_url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('retorna 404 se o presente nao existe', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ presenteId: 9999, nomeConvidado: 'X', mensagem: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('cria um pedido sem mensagem (usa string vazia como padrao)', async () => {
    const presente = await criarPresenteDisponivel();
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ presenteId: presente.id, nomeConvidado: 'Beatriz' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.pedido.mensagem).toBe('');
  });

  it('retorna 404 se o presente existe mas ja foi reservado (controller lanca erro)', async () => {
    const presente = await criarPresenteDisponivel();
    const { atualizarStatus } = await import('@/models/presentes');
    atualizarStatus(presente.id, 'reservado');
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ presenteId: presente.id, nomeConvidado: 'X', mensagem: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('retorna 400 quando o nome do convidado esta vazio (erro de validacao)', async () => {
    const presente = await criarPresenteDisponivel();
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ presenteId: presente.id, nomeConvidado: '  ', mensagem: '' }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.erro).toBe('Preencha o campo "Seu nome"');
  });

  it('rejeita tipos invalidos com erro generico (sem vazar TypeError)', async () => {
    const presente = await criarPresenteDisponivel();
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ presenteId: presente.id, nomeConvidado: 'X', mensagem: 123 }),
    }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.erro).toBe('Preencha o campo "Mensagem" com texto');
  });

  it('nao reserva o mesmo presente duas vezes em requisicoes simultaneas', async () => {
    const presente = await criarPresenteDisponivel();
    const { criar } = await import('@/controllers/pedidosController');
    const dados = { presenteId: presente.id, nomeConvidado: 'A', mensagem: '' };
    const resultados = await Promise.allSettled([criar(dados), criar(dados)]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
