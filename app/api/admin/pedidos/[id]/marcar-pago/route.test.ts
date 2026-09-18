// app/api/admin/pedidos/[id]/marcar-pago/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../_sessao', () => ({ resolverCasamentoIdDaSessao: vi.fn() }));
vi.mock('@/controllers/pedidosController', () => ({ marcarPago: vi.fn() }));

const params = Promise.resolve({ id: '3' });

describe('POST /api/admin/pedidos/[id]/marcar-pago', () => {
  it('retorna 401 sem sessao', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../../../_sessao');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(undefined);
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params });
    expect(response.status).toBe(401);
  });

  it('retorna 404 quando o pedido nao pertence ao casamento', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../../../_sessao');
    const { marcarPago } = await import('@/controllers/pedidosController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(marcarPago).mockImplementation(() => { throw new Error('pedido nao encontrado'); });
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params });
    expect(response.status).toBe(404);
  });

  it('marca como pago com sucesso', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../../../_sessao');
    const { marcarPago } = await import('@/controllers/pedidosController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(marcarPago).mockImplementation(() => undefined);
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params });
    expect(response.status).toBe(200);
    expect(marcarPago).toHaveBeenCalledWith(7, 3);
  });
});
