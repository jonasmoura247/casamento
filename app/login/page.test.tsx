// @vitest-environment jsdom
// app/login/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./LoginForm', () => ({ default: () => <div>login-form-mock</div> }));

describe('LoginPage', () => {
  it('renderiza o LoginForm', async () => {
    const { default: LoginPage } = await import('./page');
    render(<LoginPage />);
    expect(screen.getByText('login-form-mock')).toBeInTheDocument();
  });
});
