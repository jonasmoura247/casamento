// app/api/login/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/controllers/authController', () => ({ login: vi.fn() }));

function req(body: unknown) {
  return new Request('http://localhost/api/login', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/login', () => {
  it('retorna 401 com a mensagem de erro quando as credenciais sao invalidas', async () => {
    const { login } = await import('@/controllers/authController');
    vi.mocked(login).mockImplementation(() => { throw new Error('E-mail ou senha incorretos'); });
    const { POST } = await import('./route');
    const response = await POST(req({ email: 'a@b.com', senha: 'x' }));
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.erro).toBe('E-mail ou senha incorretos');
  });

  it('loga com sucesso e seta o cookie de sessao', async () => {
    const { login } = await import('@/controllers/authController');
    vi.mocked(login).mockReturnValue({ token: 'token-xyz' });
    const { POST } = await import('./route');
    const response = await POST(req({ email: 'a@b.com', senha: 'certa' }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(response.cookies.get('sessao')?.value).toBe('token-xyz');
  });
});
