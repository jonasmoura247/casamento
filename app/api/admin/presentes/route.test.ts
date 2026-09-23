// app/api/admin/presentes/route.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ErroValidacao } from '@/lib/validacao';

vi.mock('../../_sessao', () => ({ resolverCasamentoIdDaSessao: vi.fn() }));
vi.mock('@/controllers/presentesController', () => ({ criar: vi.fn(), listar: vi.fn() }));

describe('GET /api/admin/presentes', () => {
  it('retorna 401 sem sessao', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../_sessao');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(undefined);
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('retorna a lista de presentes do casamento logado', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../_sessao');
    const { listar } = await import('@/controllers/presentesController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(listar).mockReturnValue([{ id: 1 } as never]);
    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.presentes).toHaveLength(1);
    expect(listar).toHaveBeenCalledWith(7);
  });
});

describe('POST /api/admin/presentes', () => {
  it('retorna 401 sem sessao', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../_sessao');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(undefined);
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/admin/presentes', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(401);
  });

  it('cria o presente com valores padrao quando descricao/imagens nao vem', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../_sessao');
    const { criar } = await import('@/controllers/presentesController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(criar).mockReturnValue({ id: 1, nome: 'Panela' } as never);
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/admin/presentes', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Panela', preco: '100' }),
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.presente.nome).toBe('Panela');
    expect(criar).toHaveBeenCalledWith(7, { nome: 'Panela', preco: '100' });
  });

  it('aceita descricao e imagens quando informadas', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../_sessao');
    const { criar } = await import('@/controllers/presentesController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(criar).mockReturnValue({ id: 2 } as never);
    const { POST } = await import('./route');
    await POST(new Request('http://localhost/api/admin/presentes', {
      method: 'POST',
      body: JSON.stringify({ nome: 'X', descricao: 'Y', preco: '10', imagens: ['a.jpg'] }),
    }));
    expect(criar).toHaveBeenCalledWith(7, { nome: 'X', descricao: 'Y', preco: '10', imagens: ['a.jpg'] });
  });

  it('retorna 400 com a mensagem de erro quando a validacao falha', async () => {
    const { resolverCasamentoIdDaSessao } = await import('../../_sessao');
    const { criar } = await import('@/controllers/presentesController');
    vi.mocked(resolverCasamentoIdDaSessao).mockResolvedValue(7);
    vi.mocked(criar).mockImplementation(() => { throw new ErroValidacao('nome do presente é obrigatório'); });
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/admin/presentes', {
      method: 'POST',
      body: JSON.stringify({ nome: '', preco: '10' }),
    }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.erro).toBe('nome do presente é obrigatório');
  });
});
