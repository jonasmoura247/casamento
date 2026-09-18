// @vitest-environment jsdom
// app/[slug]/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/controllers/casamentosController', () => ({ obterEstadoPublico: vi.fn() }));
vi.mock('@/models/presentes', () => ({ listarDisponiveis: vi.fn(() => []) }));
vi.mock('@/models/pedidos', () => ({ expirarPedidosAntigos: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));

const CASAMENTO_BASE = {
  id: 1, slug: 'jonasenatalia', nome_casal: 'Jonas & Natália', data_casamento: '2027-01-01',
  local: '', mensagem: '', pix_key: 'x', pix_nome_recebedor: 'X', pix_cidade: 'X', mostrar_contador: 1,
};

describe('PaginaCasamento', () => {
  it('chama notFound quando o slug nao existe', async () => {
    const { obterEstadoPublico } = await import('@/controllers/casamentosController');
    vi.mocked(obterEstadoPublico).mockReturnValue(undefined);
    const { default: PaginaCasamento } = await import('./page');

    await expect(PaginaCasamento({ params: Promise.resolve({ slug: 'nao-existe' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('mostra tela de encerramento quando o casamento ja expirou', async () => {
    const { obterEstadoPublico } = await import('@/controllers/casamentosController');
    vi.mocked(obterEstadoPublico).mockReturnValue({ casamento: CASAMENTO_BASE, expirado: true });
    const { default: PaginaCasamento } = await import('./page');

    const elemento = await PaginaCasamento({ params: Promise.resolve({ slug: 'jonasenatalia' }) });
    render(elemento);
    expect(screen.getByText(/já aconteceu/)).toBeInTheDocument();
  });

  it('mostra contador e mensagem quando o casamento ainda nao aconteceu', async () => {
    const { obterEstadoPublico } = await import('@/controllers/casamentosController');
    vi.mocked(obterEstadoPublico).mockReturnValue({
      casamento: { ...CASAMENTO_BASE, mensagem: 'Com carinho' },
      expirado: false,
    });
    const { default: PaginaCasamento } = await import('./page');

    const elemento = await PaginaCasamento({ params: Promise.resolve({ slug: 'jonasenatalia' }) });
    render(elemento);
    expect(screen.getByText('Jonas & Natália')).toBeInTheDocument();
    expect(screen.getByText('Com carinho')).toBeInTheDocument();
    expect(screen.getByText('dias')).toBeInTheDocument();
  });

  it('esconde o contador quando mostrar_contador esta desligado', async () => {
    const { obterEstadoPublico } = await import('@/controllers/casamentosController');
    vi.mocked(obterEstadoPublico).mockReturnValue({
      casamento: { ...CASAMENTO_BASE, mostrar_contador: 0 as 0 | 1, mensagem: '' },
      expirado: false,
    });
    const { default: PaginaCasamento } = await import('./page');

    const elemento = await PaginaCasamento({ params: Promise.resolve({ slug: 'jonasenatalia' }) });
    render(elemento);
    expect(screen.queryByText('dias')).not.toBeInTheDocument();
  });
});
