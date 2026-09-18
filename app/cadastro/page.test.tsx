// @vitest-environment jsdom
// app/cadastro/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./CadastroForm', () => ({ default: () => <div>cadastro-form-mock</div> }));

describe('CadastroPage', () => {
  it('renderiza o CadastroForm', async () => {
    const { default: CadastroPage } = await import('./page');
    render(<CadastroPage />);
    expect(screen.getByText('cadastro-form-mock')).toBeInTheDocument();
  });
});
