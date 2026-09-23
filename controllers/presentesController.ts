// controllers/presentesController.ts
import {
  criarPresente,
  buscarPorId,
  listarTodos,
  atualizarPresente,
  removerPresente,
  type Presente,
} from '../models/presentes';
import { ErroValidacao, texto, urlHttps } from '../lib/validacao';

const PRECO_MAX = 1_000_000;

// Valida e normaliza entrada não confiável; campos ausentes ficam de fora (PATCH parcial).
function validar(dados: Record<string, unknown>): Parameters<typeof atualizarPresente>[1] {
  const out: Record<string, unknown> = {};
  if (dados.nome !== undefined) out.nome = texto(dados.nome, 'nome do presente', 100, { obrigatorio: true });
  if (dados.descricao !== undefined) out.descricao = texto(dados.descricao, 'descrição', 500);
  if (dados.preco !== undefined) {
    const preco = typeof dados.preco === 'string' && dados.preco.trim() !== '' ? Number(dados.preco) : dados.preco;
    if (typeof preco !== 'number' || !Number.isFinite(preco) || preco <= 0 || preco > PRECO_MAX) {
      throw new ErroValidacao(`preço deve ser um número maior que zero e no máximo ${PRECO_MAX}`);
    }
    out.preco = preco;
  }
  if (dados.imagens !== undefined) {
    if (!Array.isArray(dados.imagens) || dados.imagens.length > 5) throw new ErroValidacao('imagens inválidas (máximo 5)');
    out.imagens = dados.imagens.filter((u) => u !== '').map((u) => urlHttps(u, 'imagem'));
  }
  return out;
}

export function criar(casamentoId: number, dados: Record<string, unknown>): Presente {
  if (dados.nome === undefined || dados.preco === undefined) {
    throw new ErroValidacao('nome e preço são obrigatórios');
  }
  const v = validar(dados);
  return criarPresente({ casamentoId, descricao: '', imagens: [], ...v } as Parameters<typeof criarPresente>[0]);
}

export function listar(casamentoId: number): Presente[] {
  return listarTodos(casamentoId);
}

export function atualizar(
  casamentoId: number,
  id: number,
  dados: Record<string, unknown>
): void {
  const presente = buscarPorId(id);
  if (!presente || presente.casamento_id !== casamentoId) {
    throw new ErroValidacao('presente nao encontrado');
  }
  atualizarPresente(id, validar(dados));
}

export function remover(casamentoId: number, id: number): void {
  const presente = buscarPorId(id);
  if (!presente || presente.casamento_id !== casamentoId) {
    throw new ErroValidacao('presente nao encontrado');
  }
  removerPresente(id);
}
