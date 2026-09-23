// app/api/login/route.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/controllers/authController', () => ({ login: vi.fn() }));

function req(body: unknown, ip = '1.2.3.4') {
  return new Request('http://localhost/api/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': ip },
  });
}

describe('POST /api/login', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('retorna 429 apos exceder o limite de tentativas', async () => {
    const { login } = await import('@/controllers/authController');
    vi.mocked(login).mockReturnValue({ token: 't' });
    const { POST } = await import('./route');
    const ip = 'ip-login-limite';
    for (let i = 0; i < 10; i++) {
      await POST(req({ email: 'a@b.com', senha: 'x' }, ip));
    }
    const response = await POST(req({ email: 'a@b.com', senha: 'x' }, ip));
    expect(response.status).toBe(429);
  });

  it('retorna 401 com a mensagem de erro quando as credenciais sao invalidas', async () => {
    const { login } = await import('@/controllers/authController');
    const { ErroValidacao } = await import('@/lib/validacao'); // mesma instancia do modulo que a rota vai importar
    vi.mocked(login).mockImplementation(() => { throw new ErroValidacao('E-mail ou senha incorretos'); });
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
