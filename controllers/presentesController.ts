// controllers/presentesController.ts
import {
  criarPresente,
  buscarPorId,
  listarTodos,
  atualizarPresente,
  removerPresente,
  type Presente,
} from '../models/presentes';

export function criar(
  casamentoId: number,
  dados: Omit<Parameters<typeof criarPresente>[0], 'casamentoId'>
): Presente {
  return criarPresente({ casamentoId, ...dados });
}

export function listar(casamentoId: number): Presente[] {
  return listarTodos(casamentoId);
}

export function atualizar(
  casamentoId: number,
  id: number,
  dados: Parameters<typeof atualizarPresente>[1]
): void {
  const presente = buscarPorId(id);
  if (!presente || presente.casamento_id !== casamentoId) {
    throw new Error('presente nao encontrado');
  }
  atualizarPresente(id, dados);
}

export function remover(casamentoId: number, id: number): void {
  const presente = buscarPorId(id);
  if (!presente || presente.casamento_id !== casamentoId) {
    throw new Error('presente nao encontrado');
  }
  removerPresente(id);
}
