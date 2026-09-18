// @vitest-environment jsdom
// app/page.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('mostra a chamada principal e os links de cadastro/login', () => {
    render(<Home />);
    expect(screen.getByText('Sua lista, seu link, seu Pix')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar minha lista' })).toHaveAttribute('href', '/cadastro');
    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/login');
  });
});
