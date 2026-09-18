// app/api/admin/pedidos/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../_sessao', () => ({ resolverCasamentoIdDaSessao: vi.fn() }));
vi.mock('@/controllers/pedidosController', () => ({ listar: vi.fn() }));

describe('GET /api/admin/pedidos', () => {
  it('retorna 401 sem sessao', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../_sessao');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(undefined);
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('retorna os pedidos do casamento logado', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../_sessao');
    const { listar } = await import('@/controllers/pedidosController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(listar).mockReturnValue([{ id: 1 } as never]);
    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.pedidos).toHaveLength(1);
    expect(listar).toHaveBeenCalledWith(7);
  });
});
