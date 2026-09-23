// lib/rateLimit.test.ts
import { describe, it, expect } from 'vitest';
import { excedeuLimite } from './rateLimit';

describe('excedeuLimite', () => {
  it('libera as primeiras `max` chamadas e bloqueia a seguinte', () => {
    const chave = 'ip-teste-1';
    expect(excedeuLimite(chave, 3, 60_000)).toBe(false);
    expect(excedeuLimite(chave, 3, 60_000)).toBe(false);
    expect(excedeuLimite(chave, 3, 60_000)).toBe(false);
    expect(excedeuLimite(chave, 3, 60_000)).toBe(true);
  });

  it('reseta a contagem depois que a janela expira', () => {
    const chave = 'ip-teste-2';
    expect(excedeuLimite(chave, 1, -1)).toBe(false);
    expect(excedeuLimite(chave, 1, 60_000)).toBe(false);
  });

  it('chaves diferentes tem contadores independentes', () => {
    expect(excedeuLimite('ip-a', 1, 60_000)).toBe(false);
    expect(excedeuLimite('ip-b', 1, 60_000)).toBe(false);
  });
});

describe('obterIp', () => {
  it('usa o ultimo item de x-forwarded-for (o primeiro e forjavel)', async () => {
    const { obterIp } = await import('./rateLimit');
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '6.6.6.6, 1.2.3.4' } });
    expect(obterIp(req)).toBe('1.2.3.4');
  });
});
