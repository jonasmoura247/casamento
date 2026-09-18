// app/api/logout/route.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/controllers/authController', () => ({ logout: vi.fn() }));

describe('POST /api/logout', () => {
  it('chama logout quando ha cookie de sessao e limpa o cookie', async () => {
    const { cookies } = await import('next/headers');
    const { logout } = await import('@/controllers/authController');
    vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: 'token-abc' }) } as never);
    const { POST } = await import('./route');
    const response = await POST();
    expect(logout).toHaveBeenCalledWith('token-abc');
    expect(response.cookies.get('sessao')?.value).toBe('');
  });

  it('nao chama logout quando nao ha cookie de sessao', async () => {
    const { cookies } = await import('next/headers');
    const { logout } = await import('@/controllers/authController');
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as never);
    const { POST } = await import('./route');
    const response = await POST();
    expect(logout).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
