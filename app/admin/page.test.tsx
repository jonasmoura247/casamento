// @vitest-environment jsdom
// app/admin/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./Painel', () => ({ default: () => <div>painel-mock</div> }));

describe('AdminPage', () => {
  it('renderiza o Painel', async () => {
    const { default: AdminPage } = await import('./page');
    render(<AdminPage />);
    expect(screen.getByText('painel-mock')).toBeInTheDocument();
  });
});
