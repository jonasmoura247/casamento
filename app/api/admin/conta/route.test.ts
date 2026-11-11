// app/api/admin/conta/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/models/sessoes', () => ({ resolverContaIdPorToken: vi.fn() }));
vi.mock('@/models/casamentos', () => ({ buscarPorContaId: vi.fn() }));
vi.mock('@/controllers/authController', () => ({ excluirConta: vi.fn() }));

function semCookie() {
  return { get: () => undefined } as never;
}
function comCookie(valor: string) {
  return { get: () => ({ value: valor }) } as never;
}

describe('DELETE /api/admin/conta', () => {
  it('retorna 401 sem cookie de sessao', async () => {
    const { cookies } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue(semCookie());
    const { DELETE } = await import('./route');
    const response = await DELETE();
    expect(response.status).toBe(401);
  });

  it('retorna 401 quando o token nao resolve conta', async () => {
    const { cookies } = await import('next/headers');
    const { resolverContaIdPorToken } = await import('@/models/sessoes');
    vi.mocked(cookies).mockResolvedValue(comCookie('token'));
    vi.mocked(resolverContaIdPorToken).mockReturnValue(undefined);
    const { DELETE } = await import('./route');
    const response = await DELETE();
    expect(response.status).toBe(401);
  });

  it('retorna 401 quando a conta nao tem casamento', async () => {
    const { cookies } = await import('next/headers');
    const { resolverContaIdPorToken } = await import('@/models/sessoes');
    const { buscarPorContaId } = await import('@/models/casamentos');
    vi.mocked(cookies).mockResolvedValue(comCookie('token'));
    vi.mocked(resolverContaIdPorToken).mockReturnValue(1);
    vi.mocked(buscarPorContaId).mockReturnValue(undefined);
    const { DELETE } = await import('./route');
    const response = await DELETE();
    expect(response.status).toBe(401);
  });

  it('exclui a conta e limpa o cookie de sessao', async () => {
    const { cookies } = await import('next/headers');
    const { resolverContaIdPorToken } = await import('@/models/sessoes');
    const { buscarPorContaId } = await import('@/models/casamentos');
    const { excluirConta } = await import('@/controllers/authController');
    vi.mocked(cookies).mockResolvedValue(comCookie('token'));
    vi.mocked(resolverContaIdPorToken).mockReturnValue(1);
    vi.mocked(buscarPorContaId).mockReturnValue({ id: 9 } as never);
    const { DELETE } = await import('./route');
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(excluirConta).toHaveBeenCalledWith(1, 9);
    expect(response.cookies.get('sessao')?.value).toBe('');
  });
});
