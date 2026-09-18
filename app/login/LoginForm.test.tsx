// @vitest-environment jsdom
// app/login/LoginForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('LoginForm', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('redireciona pro /admin quando o login da certo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true }));
    const { default: LoginForm } = await import('./LoginForm');
    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'senha123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin'));
    vi.unstubAllGlobals();
  });

  it('mostra erro quando o login falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }));
    const { default: LoginForm } = await import('./LoginForm');
    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'errada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByText('E-mail ou senha incorretos')).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('tem link pra criar conta', async () => {
    const { default: LoginForm } = await import('./LoginForm');
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: 'Criar minha lista' })).toHaveAttribute('href', '/cadastro');
  });
});
