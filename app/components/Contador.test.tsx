// @vitest-environment jsdom
// app/components/Contador.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Contador from './Contador';

describe('Contador', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra dias/horas/minutos/segundos restantes até a data alvo', () => {
    render(<Contador dataCasamento="2026-01-03" />);
    expect(screen.getByText('dias')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('mostra zero quando a data já passou', () => {
    render(<Contador dataCasamento="2025-01-01" />);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('atualiza a contagem a cada segundo', () => {
    render(<Contador dataCasamento="2026-01-01" />);
    expect(screen.getAllByText('segundos').length).toBeGreaterThan(0);
    vi.advanceTimersByTime(1000);
    expect(screen.getAllByText('segundos').length).toBeGreaterThan(0);
  });
});
