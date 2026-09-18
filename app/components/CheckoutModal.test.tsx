// @vitest-environment jsdom
// app/components/CheckoutModal.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CheckoutModal from './CheckoutModal';

function mockFetchOnce(body: unknown, ok = true) {
  return vi.fn().mockResolvedValueOnce({ ok, json: async () => body });
}

describe('CheckoutModal', () => {
  const onFechar = vi.fn();
  const onPago = vi.fn();

  beforeEach(() => {
    onFechar.mockClear();
    onPago.mockClear();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('envia a reserva e mostra o QR code Pix', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({
      pedido: { id: 1, pix_copia_cola: 'CODIGO123', pix_qr_code_data_url: 'data:image/png;base64,abc' },
    }));
    render(<CheckoutModal presenteId={1} nome="Panela" preco={100} onFechar={onFechar} onPago={onPago} />);

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Convidado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Pix' }));

    await waitFor(() => expect(screen.getByAltText('QR Code Pix')).toBeInTheDocument());
  });

  it('mostra erro quando a reserva falha', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ erro: 'x' }, false));
    render(<CheckoutModal presenteId={1} nome="Panela" preco={100} onFechar={onFechar} onPago={onPago} />);

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Convidado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Pix' }));

    await waitFor(() => expect(screen.getByText('Não foi possível gerar o Pix. Tente novamente.')).toBeInTheDocument());
  });

  it('mostra erro quando o fetch rejeita (rede)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('rede')));
    render(<CheckoutModal presenteId={1} nome="Panela" preco={100} onFechar={onFechar} onPago={onPago} />);

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Convidado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Pix' }));

    await waitFor(() => expect(screen.getByText('Não foi possível gerar o Pix. Tente novamente.')).toBeInTheDocument());
  });

  it('copia o código Pix ao clicar em Copiar código Pix e reseta depois de 2s', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({
      pedido: { id: 1, pix_copia_cola: 'CODIGO123', pix_qr_code_data_url: 'data:image/png;base64,abc' },
    }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<CheckoutModal presenteId={1} nome="Panela" preco={100} onFechar={onFechar} onPago={onPago} />);

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Convidado' } });
    fireEvent.change(screen.getByPlaceholderText('Mensagem para os noivos (opcional)'), { target: { value: 'Parabéns!' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar Pix' }));
    });
    await waitFor(() => expect(screen.getByText('Copiar código Pix')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Copiar código Pix'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('CODIGO123');
    await waitFor(() => expect(screen.getByText('Código copiado!')).toBeInTheDocument());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('Copiar código Pix')).toBeInTheDocument();
  });

  it('faz polling e mostra confirmação quando o pedido é marcado como pago', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pedido: { id: 1, pix_copia_cola: 'X', pix_qr_code_data_url: 'data:image/png;base64,x' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pedido: { status: 'aguardando_pagamento' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pedido: { status: 'pago' } }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    render(<CheckoutModal presenteId={1} nome="Panela" preco={100} onFechar={onFechar} onPago={onPago} />);

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Convidado' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar Pix' }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onPago).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByText('Presente confirmado, muito obrigado!')).toBeInTheDocument();
    expect(onPago).toHaveBeenCalled();
  });

  it('ignora falha temporária do polling e continua tentando', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pedido: { id: 1, pix_copia_cola: 'X', pix_qr_code_data_url: 'data:image/png;base64,x' } }) })
      .mockRejectedValueOnce(new Error('falha de rede'));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    render(<CheckoutModal presenteId={1} nome="Panela" preco={100} onFechar={onFechar} onPago={onPago} />);

    fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Convidado' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar Pix' }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByText(/Copiar código Pix|Código copiado!/)).toBeInTheDocument();
    expect(onPago).not.toHaveBeenCalled();
  });

  it('fecha o modal ao clicar em Fechar e ao clicar fora', () => {
    render(<CheckoutModal presenteId={1} nome="Panela" preco={100} onFechar={onFechar} onPago={onPago} />);
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});
