// app/api/admin/presentes/[id]/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../_sessao', () => ({ resolverCasamentoIdDaSessao: vi.fn() }));
vi.mock('@/controllers/presentesController', () => ({ atualizar: vi.fn(), remover: vi.fn() }));

function req(body: unknown = {}) {
  return new Request('http://localhost/api/admin/presentes/1', { method: 'PATCH', body: JSON.stringify(body) });
}
const params = Promise.resolve({ id: '1' });

describe('PATCH /api/admin/presentes/[id]', () => {
  it('retorna 401 sem sessao', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../../_sessao');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(undefined);
    const { PATCH } = await import('./route');
    const response = await PATCH(req(), { params });
    expect(response.status).toBe(401);
  });

  it('retorna 404 quando o presente nao pertence ao casamento', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../../_sessao');
    const { atualizar } = await import('@/controllers/presentesController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(atualizar).mockImplementation(() => { throw new Error('presente nao encontrado'); });
    const { PATCH } = await import('./route');
    const response = await PATCH(req({ nome: 'X' }), { params });
    expect(response.status).toBe(404);
  });

  it('atualiza com sucesso', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../../_sessao');
    const { atualizar } = await import('@/controllers/presentesController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(atualizar).mockImplementation(() => undefined);
    const { PATCH } = await import('./route');
    const response = await PATCH(req({ nome: 'X' }), { params });
    expect(response.status).toBe(200);
    expect(atualizar).toHaveBeenCalledWith(7, 1, { nome: 'X' });
  });
});

describe('DELETE /api/admin/presentes/[id]', () => {
  it('retorna 401 sem sessao', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../../_sessao');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(undefined);
    const { DELETE } = await import('./route');
    const response = await DELETE(req(), { params });
    expect(response.status).toBe(401);
  });

  it('retorna 404 quando o presente nao pertence ao casamento', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../../_sessao');
    const { remover } = await import('@/controllers/presentesController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(remover).mockImplementation(() => { throw new Error('presente nao encontrado'); });
    const { DELETE } = await import('./route');
    const response = await DELETE(req(), { params });
    expect(response.status).toBe(404);
  });

  it('remove com sucesso', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../../_sessao');
    const { remover } = await import('@/controllers/presentesController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(remover).mockImplementation(() => undefined);
    const { DELETE } = await import('./route');
    const response = await DELETE(req(), { params });
    expect(response.status).toBe(200);
    expect(remover).toHaveBeenCalledWith(7, 1);
  });
});
