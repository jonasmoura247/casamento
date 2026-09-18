// app/api/cadastro/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/controllers/authController', () => ({ cadastrar: vi.fn() }));

function req(body: unknown) {
  return new Request('http://localhost/api/cadastro', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/cadastro', () => {
  it('retorna 400 com a mensagem de erro quando o cadastro falha', async () => {
    const { cadastrar } = await import('@/controllers/authController');
    vi.mocked(cadastrar).mockImplementation(() => { throw new Error('E-mail já cadastrado'); });
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
