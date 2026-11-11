// middleware.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function criarRequest(path: string, cookie?: string) {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    headers: cookie ? { cookie } : undefined,
  });
}

describe('middleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('bloqueia /api/admin/* sem cookie de sessao com 401', async () => {
    const response = middleware(criarRequest('/api/admin/presentes'));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.erro).toBe('Nao autorizado');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
  });

  it('deixa passar /api/admin/* com cookie de sessao', () => {
    const response = middleware(criarRequest('/api/admin/presentes', 'sessao=abc123'));
    expect(response.status).toBe(200);
  });

  it('deixa passar rotas normais mesmo sem sessao', () => {
    const response = middleware(criarRequest('/admin'));
    expect(response.status).toBe(200);
  });

  it('aplica CSP com nonce em toda resposta', () => {
    const response = middleware(criarRequest('/'));
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain('nonce-');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
  });

  it('usa unsafe-eval e unsafe-inline em desenvolvimento', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = middleware(criarRequest('/'));
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('nao usa unsafe-eval nem unsafe-inline em producao', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = middleware(criarRequest('/'));
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('unsafe-inline');
  });
});
