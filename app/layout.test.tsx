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
    const [conteudo] = elemento.props.children.props.children;
    expect(conteudo.props.children.props.children).toBe('conteudo');
  });

  it('usa um titulo neutro (o nome do casal vem de cada pagina)', async () => {
    const mod = await import('./layout');
    expect(mod.metadata.title).toBe('Lista de Presentes de Casamento');
  });
});
