// app/api/pedidos/[id]/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-api-status.db');

const globalForDb = globalThis as unknown as { __db?: { close: () => void } };

function closeDb() {
  globalForDb.__db?.close();
  delete globalForDb.__db;
}

function removeTestDbFiles() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const filePath = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

describe('GET /api/pedidos/[id]', () => {
  const originalDbPath = process.env.DB_PATH;

  beforeEach(() => {
    closeDb();
    removeTestDbFiles();
    process.env.DB_PATH = TEST_DB_PATH;
  });

  afterEach(() => {
    closeDb();
    removeTestDbFiles();

    if (originalDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = originalDbPath;
    }
  });

  it('retorna o status atual do pedido', async () => {
    const { cadastrar } = await import('@/controllers/authController');
    const { criarPresente } = await import('@/models/presentes');
    const { criarPedido } = await import('@/models/pedidos');
    const { casamento } = cadastrar({
      email: 'ii@b.com', senha: '12345678', slug: 'api-status-teste',
      nomeCasal: 'Teste', dataCasamento: '2027-01-01', local: '', mensagem: '',
      pixKey: 'x', pixNomeRecebedor: 'X', pixCidade: 'X',
    });
    const presente = criarPresente({ casamentoId: casamento.id, nome: 'Panela de pressao', descricao: '', preco: 200, imagens: [] });
    const pedido = criarPedido({
      presenteId: presente.id,
      nomeConvidado: 'Rafael',
      mensagem: '',
      pixCopiaCola: 'x',
      pixQrCodeDataUrl: 'data:image/png;base64,eA==',
    });

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: String(pedido.id) }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pedido.status).toBe('aguardando_pagamento');
    expect(body.pedido).toEqual({ status: 'aguardando_pagamento' });
  });

  it('retorna 404 para pedido inexistente', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '9999' }) });
    expect(response.status).toBe(404);
  });
});
