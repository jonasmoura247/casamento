// app/api/admin/casamento/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/models/sessoes', () => ({ resolverContaIdPorToken: vi.fn() }));
vi.mock('@/models/casamentos', () => ({ buscarPorContaId: vi.fn() }));
vi.mock('@/controllers/casamentosController', () => ({ atualizarDados: vi.fn() }));

function semCookie() {
  return { get: () => undefined } as never;
}
function comCookie(valor: string) {
  return { get: () => ({ value: valor }) } as never;
}

describe('GET /api/admin/casamento', () => {
  it('retorna 401 sem cookie de sessao', async () => {
    const { cookies } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue(semCookie());
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('retorna 401 quando o token nao resolve conta', async () => {
    const { cookies } = await import('next/headers');
    const { resolverContaIdPorToken } = await import('@/models/sessoes');
    vi.mocked(cookies).mockResolvedValue(comCookie('token'));
    vi.mocked(resolverContaIdPorToken).mockReturnValue(undefined);
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('retorna os dados do casamento quando a sessao e valida', async () => {
    const { cookies } = await import('next/headers');
    const { resolverContaIdPorToken } = await import('@/models/sessoes');
    const { buscarPorContaId } = await import('@/models/casamentos');
    vi.mocked(cookies).mockResolvedValue(comCookie('token'));
    vi.mocked(resolverContaIdPorToken).mockReturnValue(1);
    vi.mocked(buscarPorContaId).mockReturnValue({ id: 1, slug: 'x' } as never);
    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.casamento.slug).toBe('x');
  });
});

describe('PATCH /api/admin/casamento', () => {
  it('retorna 401 sem sessao', async () => {
    const { cookies } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue(semCookie());
    const { PATCH } = await import('./route');
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: '{}' }));
    expect(response.status).toBe(401);
  });

  it('atualiza os dados do casamento', async () => {
    const { cookies } = await import('next/headers');
    const { resolverContaIdPorToken } = await import('@/models/sessoes');
    const { buscarPorContaId } = await import('@/models/casamentos');
    const { atualizarDados } = await import('@/controllers/casamentosController');
    vi.mocked(cookies).mockResolvedValue(comCookie('token'));
    vi.mocked(resolverContaIdPorToken).mockReturnValue(1);
    vi.mocked(buscarPorContaId).mockReturnValue({ id: 9 } as never);
    const { PATCH } = await import('./route');
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ mensagem: 'Oi' }) }));
    expect(response.status).toBe(200);
    expect(atualizarDados).toHaveBeenCalledWith(9, { mensagem: 'Oi' });
  });
});
