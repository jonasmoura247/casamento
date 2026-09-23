// app/api/cadastro/route.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/controllers/authController', () => ({ cadastrar: vi.fn() }));

function req(body: unknown, ip = '1.2.3.4') {
  return new Request('http://localhost/api/cadastro', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': ip },
  });
}

describe('POST /api/cadastro', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('retorna 429 apos exceder o limite de tentativas', async () => {
    const { cadastrar } = await import('@/controllers/authController');
    vi.mocked(cadastrar).mockReturnValue({ token: 't', casamento: { id: 1 } as never });
    const { POST } = await import('./route');
    const ip = 'ip-cadastro-limite';
    for (let i = 0; i < 5; i++) {
      await POST(req({ email: 'a@b.com' }, ip));
    }
    const response = await POST(req({ email: 'a@b.com' }, ip));
    expect(response.status).toBe(429);
  });

  it('retorna 400 com a mensagem de erro quando o cadastro falha', async () => {
    const { cadastrar } = await import('@/controllers/authController');
    const { ErroValidacao } = await import('@/lib/validacao'); // mesma instancia do modulo que a rota vai importar
    vi.mocked(cadastrar).mockImplementation(() => { throw new ErroValidacao('E-mail já cadastrado'); });
    const { POST } = await import('./route');
    const response = await POST(req({ email: 'a@b.com' }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.erro).toBe('E-mail já cadastrado');
  });

  it('cria a conta, retorna 201 e seta o cookie de sessao', async () => {
    const { cadastrar } = await import('@/controllers/authController');
    vi.mocked(cadastrar).mockReturnValue({ token: 'token-abc', casamento: { id: 1, slug: 'x' } as never });
    const { POST } = await import('./route');
    const response = await POST(req({ email: 'a@b.com' }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.casamento.slug).toBe('x');
    expect(response.cookies.get('sessao')?.value).toBe('token-abc');
  });
});
