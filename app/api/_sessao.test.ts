// app/api/_sessao.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/models/sessoes', () => ({ resolverContaIdPorToken: vi.fn() }));
vi.mock('@/models/casamentos', () => ({ buscarPorContaId: vi.fn() }));

describe('resolverCasamentoIdDaSessao', () => {
  it('retorna undefined quando nao ha cookie de sessao', async () => {
    const { cookies } = await import('next/headers');
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as never);
    const { resolverCasamentoIdDaSessao } = await import('./_sessao');
    expect(await resolverCasamentoIdDaSessao()).toBeUndefined();
  });

  it('retorna undefined quando o token nao resolve conta', async () => {
    const { cookies } = await import('next/headers');
    const { resolverContaIdPorToken } = await import('@/models/sessoes');
    vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: 'token-invalido' }) } as never);
    vi.mocked(resolverContaIdPorToken).mockReturnValue(undefined);
    const { resolverCasamentoIdDaSessao } = await import('./_sessao');
    expect(await resolverCasamentoIdDaSessao()).toBeUndefined();
  });

  it('retorna undefined quando a conta nao tem casamento', async () => {
    const { cookies } = await import('next/headers');
    const { resolverContaIdPorToken } = await import('@/models/sessoes');
    const { buscarPorContaId } = await import('@/models/casamentos');
    vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: 'token-valido' }) } as never);
    vi.mocked(resolverContaIdPorToken).mockReturnValue(5);
    vi.mocked(buscarPorContaId).mockReturnValue(undefined);
    const { resolverCasamentoIdDaSessao } = await import('./_sessao');
    expect(await resolverCasamentoIdDaSessao()).toBeUndefined();
  });

  it('retorna o id do casamento quando tudo resolve', async () => {
    const { cookies } = await import('next/headers');
    const { resolverContaIdPorToken } = await import('@/models/sessoes');
    const { buscarPorContaId } = await import('@/models/casamentos');
    vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: 'token-valido' }) } as never);
    vi.mocked(resolverContaIdPorToken).mockReturnValue(5);
    vi.mocked(buscarPorContaId).mockReturnValue({ id: 42 } as never);
    const { resolverCasamentoIdDaSessao } = await import('./_sessao');
    expect(await resolverCasamentoIdDaSessao()).toBe(42);
  });
});
