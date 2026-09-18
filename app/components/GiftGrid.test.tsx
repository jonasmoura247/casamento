// @vitest-environment jsdom
// app/components/GiftGrid.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import GiftGrid from './GiftGrid';

const PRESENTE = { id: 1, nome: 'Panela', descricao: 'Antiaderente', preco: 100, imagens: ['https://exemplo.com/foto.jpg'] };
const PRESENTE_SEM_FOTO = { id: 2, nome: 'Jogo de toalhas', descricao: 'Felpudo', preco: 50, imagens: [] };

describe('GiftGrid', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mostra mensagem de agradecimento quando não há presentes', () => {
    render(<GiftGrid presentesIniciais={[]} />);
    expect(screen.getByText(/Todos os presentes já foram escolhidos/)).toBeInTheDocument();
  });

  it('lista os presentes com nome, descrição e preço', () => {
    render(<GiftGrid presentesIniciais={[PRESENTE, PRESENTE_SEM_FOTO]} />);
    expect(screen.getByText('Panela')).toBeInTheDocument();
    expect(screen.getByText('R$ 100.00')).toBeInTheDocument();
    expect(screen.getByText('Jogo de toalhas')).toBeInTheDocument();
  });

  it('abre o modal de checkout ao clicar em Presentear', () => {
    render(<GiftGrid presentesIniciais={[PRESENTE]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Presentear' })[0]);
    expect(screen.getByText('R$ 100.00', { selector: 'p.text-foreground\\/60' })).toBeInTheDocument();
  });

  it('remove o presente da grade quando o pedido é marcado como pago', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pedido: { id: 1, pix_copia_cola: 'X', pix_qr_code_data_url: 'data:image/png;base64,x' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pedido: { status: 'pago' } }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    render(<GiftGrid presentesIniciais={[PRESENTE]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Presentear' })[0]);
    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Convidado' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar Pix' }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    vi.useRealTimers();
    await waitFor(() => expect(screen.queryByText('Panela')).not.toBeInTheDocument());
  });

  it('fecha o modal ao clicar em Fechar', () => {
    render(<GiftGrid presentesIniciais={[PRESENTE]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Presentear' })[0]);
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(screen.queryByLabelText('Fechar')).not.toBeInTheDocument();
  });
});
