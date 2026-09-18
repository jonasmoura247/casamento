// @vitest-environment jsdom
// app/cadastro/CadastroForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function preencherFormulario() {
  fireEvent.change(screen.getByPlaceholderText('Seu e-mail'), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'senha123' } });
  fireEvent.change(screen.getByPlaceholderText('Link desejado (ex: jonasenatalia)'), { target: { value: 'meu-slug' } });
  fireEvent.change(screen.getByPlaceholderText('Nome do casal'), { target: { value: 'Fulano & Fulana' } });
  fireEvent.change(screen.getByPlaceholderText('Data do casamento'), { target: { value: '2027-01-01' } });
  fireEvent.change(screen.getByPlaceholderText('Sua chave Pix'), { target: { value: 'chave@pix.com' } });
  fireEvent.change(screen.getByPlaceholderText('Nome do titular da chave Pix'), { target: { value: 'FULANO' } });
  fireEvent.change(screen.getByPlaceholderText('Cidade do titular'), { target: { value: 'SAO PAULO' } });
}

describe('CadastroForm', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('redireciona pro /admin quando o cadastro da certo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true }));
    const { default: CadastroForm } = await import('./CadastroForm');
    render(<CadastroForm />);

    preencherFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta e lista' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'));
    vi.unstubAllGlobals();
  });

  it('mostra a mensagem de erro vinda da API quando o cadastro falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ erro: 'E-mail já cadastrado' }) }));
    const { default: CadastroForm } = await import('./CadastroForm');
    render(<CadastroForm />);

    preencherFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta e lista' }));

    await waitFor(() => expect(screen.getByText('E-mail já cadastrado')).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('mostra mensagem padrão quando a API não manda erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({}) }));
    const { default: CadastroForm } = await import('./CadastroForm');
    render(<CadastroForm />);

    preencherFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta e lista' }));

    await waitFor(() => expect(screen.getByText('Não foi possível criar a conta.')).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it('tem link pra entrar', async () => {
    const { default: CadastroForm } = await import('./CadastroForm');
    render(<CadastroForm />);
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
  });
});
