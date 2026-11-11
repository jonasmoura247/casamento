// @vitest-environment jsdom
// app/privacidade/page.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('PaginaPrivacidade', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('mostra o contato configurado em PRIVACY_CONTACT_EMAIL', async () => {
    vi.stubEnv('PRIVACY_CONTACT_EMAIL', 'encarregado@exemplo.com');
    const { default: PaginaPrivacidade } = await import('./page');
    render(<PaginaPrivacidade />);
    expect(screen.getByText('Política de Privacidade')).toBeInTheDocument();
    expect(screen.getAllByText('encarregado@exemplo.com').length).toBeGreaterThan(0);
  });

  it('usa um contato padrao quando PRIVACY_CONTACT_EMAIL nao esta configurado', async () => {
    delete process.env.PRIVACY_CONTACT_EMAIL;
    const { default: PaginaPrivacidade } = await import('./page');
    render(<PaginaPrivacidade />);
    expect(screen.getAllByText('contato@exemplo.com').length).toBeGreaterThan(0);
  });
});
