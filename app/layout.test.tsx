// @vitest-environment jsdom
// app/layout.test.tsx
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans' }),
  Cormorant_Garamond: () => ({ variable: '--font-serif' }),
}));

describe('RootLayout', () => {
  it('define lang pt-BR e envolve os filhos em html/body', async () => {
    const { default: RootLayout } = await import('./layout');
    const elemento = RootLayout({ children: <p>conteudo</p> } as never);
    expect(elemento.props.lang).toBe('pt-BR');
    expect(elemento.props.className).toContain('--font-geist-sans');
    expect(elemento.props.children.props.children.props.children).toBe('conteudo');
  });

  it('usa COUPLE_NAMES do ambiente no metadata, com fallback', async () => {
    vi.resetModules();
    delete process.env.COUPLE_NAMES;
    const mod = await import('./layout');
    expect(mod.metadata.title).toBe('Nossa Lista de Presentes');
  });
});
