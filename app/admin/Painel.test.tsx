// @vitest-environment jsdom
// app/admin/Painel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Painel from './Painel';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const CASAMENTO = {
  id: 1, slug: 'jonasenatalia', nome_casal: 'Jonas & Natália', data_casamento: '2027-01-01',
  local: 'Sitio', mensagem: 'Bem-vindos', pix_key: 'x@pix.com', pix_nome_recebedor: 'JONAS', pix_cidade: 'SP',
  mostrar_contador: 1 as const,
};
const PRESENTE = { id: 1, nome: 'Panela', descricao: 'Antiaderente', preco: 100, imagens: ['https://x.com/a.jpg'], status: 'disponivel' };
const PEDIDO = { id: 1, presente_id: 1, nome_convidado: 'Convidado', mensagem: 'Parabéns!', status: 'aguardando_pagamento' };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return Promise.resolve({ ok, status, json: async () => body } as Response);
}

function mockFetchPadrao() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/admin/casamento' && (!init || init.method === undefined)) return jsonResponse({ casamento: CASAMENTO });
    if (url === '/api/admin/casamento') return jsonResponse({ ok: true });
    if (url === '/api/admin/presentes') return jsonResponse({ presentes: [PRESENTE] });
    if (url === '/api/admin/pedidos') return jsonResponse({ pedidos: [PEDIDO] });
    return jsonResponse({});
  });
}

describe('Painel', () => {
  beforeEach(() => {
    push.mockClear();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('carrega e mostra os dados do casamento, presentes e pedidos', async () => {
    vi.stubGlobal('fetch', mockFetchPadrao());
    render(<Painel />);

    await waitFor(() => expect(screen.getByDisplayValue('Jonas & Natália')).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getAllByText('Convidado').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Disponível').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aguardando pagamento').length).toBeGreaterThan(0);
  });

  it('mostra o status cru quando ele nao esta no mapa de labels', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/presentes') return jsonResponse({ presentes: [{ ...PRESENTE, status: 'status_desconhecido' }] });
      return mockFetchPadrao()(url, init);
    }));
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('status_desconhecido').length).toBeGreaterThan(0));
  });

  it('redireciona pro /login quando a sessao expirou (401)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({}, false, 401)));
    render(<Painel />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });

  it('mostra erro quando presentes/pedidos falham sem ser 401', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({}, false, 500)));
    render(<Painel />);
    await waitFor(() => expect(screen.getByText('Não foi possível carregar os dados.')).toBeInTheDocument());
  });

  it('adiciona um presente novo e recarrega a lista', async () => {
    const fetchMock = mockFetchPadrao();
    vi.stubGlobal('fetch', fetchMock);
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'Toalhas' } });
    fireEvent.change(screen.getByPlaceholderText('Descrição'), { target: { value: 'Felpudas' } });
    fireEvent.change(screen.getByPlaceholderText('Preço'), { target: { value: '80' } });
    fireEvent.change(screen.getByPlaceholderText('URL da foto 1'), { target: { value: 'https://x.com/b.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/presentes', expect.objectContaining({ method: 'POST' })));
  });

  it('mostra erro quando adicionar presente falha', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/presentes' && init?.method === 'POST') return jsonResponse({}, false);
      return mockFetchPadrao()(url, init);
    }));
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'Toalhas' } });
    fireEvent.change(screen.getByPlaceholderText('Preço'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(screen.getByText('Não foi possível adicionar o presente.')).toBeInTheDocument());
  });

  it('entra em modo de edição, preenche o formulário e salva alterações', async () => {
    const fetchMock = mockFetchPadrao();
    vi.stubGlobal('fetch', fetchMock);
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1]);
    expect(screen.getByText('Editar presente')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Panela')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/presentes/1', expect.objectContaining({ method: 'PATCH' })));
  });

  it('mostra erro quando salvar edição falha', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/presentes/1' && init?.method === 'PATCH') return jsonResponse({}, false);
      return mockFetchPadrao()(url, init);
    }));
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.getByText('Não foi possível salvar o presente.')).toBeInTheDocument());
  });

  it('cancela a edição e volta ao formulário vazio', async () => {
    vi.stubGlobal('fetch', mockFetchPadrao());
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByText('Novo presente')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nome')).toHaveValue('');
  });

  it('remove um presente e sai do modo de edição se era o que estava sendo editado', async () => {
    const fetchMock = mockFetchPadrao();
    vi.stubGlobal('fetch', fetchMock);
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover' })[1]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/presentes/1', expect.objectContaining({ method: 'DELETE' })));
    await waitFor(() => expect(screen.getByText('Novo presente')).toBeInTheDocument());
  });

  it('remove um presente sem estar editando nenhum', async () => {
    const fetchMock = mockFetchPadrao();
    vi.stubGlobal('fetch', fetchMock);
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover' })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/presentes/1', expect.objectContaining({ method: 'DELETE' })));
  });

  it('mostra erro quando remover presente falha', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/presentes/1' && init?.method === 'DELETE') return jsonResponse({}, false);
      return mockFetchPadrao()(url, init);
    }));
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover' })[0]);

    await waitFor(() => expect(screen.getByText('Não foi possível remover o presente.')).toBeInTheDocument());
  });

  it('marca um pedido como pago', async () => {
    const fetchMock = mockFetchPadrao();
    vi.stubGlobal('fetch', fetchMock);
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Convidado').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar como pago' })[1]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/pedidos/1/marcar-pago', expect.objectContaining({ method: 'POST' })));
  });

  it('mostra erro quando marcar como pago falha', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/pedidos/1/marcar-pago') return jsonResponse({}, false);
      return mockFetchPadrao()(url, init);
    }));
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Convidado').length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar como pago' })[0]);
    await waitFor(() => expect(screen.getByText('Não foi possível marcar o pedido como pago.')).toBeInTheDocument());
  });

  it('sai da conta e redireciona pro login', async () => {
    const fetchMock = mockFetchPadrao();
    vi.stubGlobal('fetch', fetchMock);
    render(<Painel />);
    await waitFor(() => expect(screen.getAllByText('Panela').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/logout', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });
});

describe('Painel - SecaoCasamento (link público)', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('mostra o link público, permite copiar e mostra feedback temporário', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', mockFetchPadrao());
    render(<Painel />);

    await waitFor(() => expect(screen.getByText(/\/jonasenatalia$/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Ver página' })).toHaveAttribute('href', '/jonasenatalia');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Link copiado!' })).toBeInTheDocument());

    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copiar link' })).toBeInTheDocument());
    vi.useRealTimers();
  });

  it('salva os dados do casamento e mostra "Salvo!" temporariamente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = mockFetchPadrao();
    vi.stubGlobal('fetch', fetchMock);
    render(<Painel />);

    await waitFor(() => expect(screen.getByDisplayValue('Jonas & Natália')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('Jonas & Natália'), { target: { value: 'Jonas & Nati' } });
    fireEvent.change(screen.getByDisplayValue('2027-01-01'), { target: { value: '2027-02-02' } });
    fireEvent.change(screen.getByDisplayValue('Sitio'), { target: { value: 'Fazenda' } });
    fireEvent.change(screen.getByDisplayValue('Bem-vindos'), { target: { value: 'Sejam bem-vindos' } });
    fireEvent.change(screen.getByDisplayValue('x@pix.com'), { target: { value: 'y@pix.com' } });
    fireEvent.change(screen.getByDisplayValue('JONAS'), { target: { value: 'JONAS E NATALIA' } });
    fireEvent.change(screen.getByDisplayValue('SP'), { target: { value: 'RJ' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/casamento', expect.objectContaining({ method: 'PATCH' })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvo!' })).toBeInTheDocument());

    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument());
    vi.useRealTimers();
  });
});
