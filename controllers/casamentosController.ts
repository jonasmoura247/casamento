// controllers/casamentosController.ts
import {
  buscarPorSlug,
  atualizarCasamento,
  estaExpirado,
  type Casamento,
} from '../models/casamentos';

export interface EstadoPublicoCasamento {
  casamento: Casamento;
  expirado: boolean;
}

export function obterEstadoPublico(slug: string): EstadoPublicoCasamento | undefined {
  const casamento = buscarPorSlug(slug);
  if (!casamento) return undefined;
  return { casamento, expirado: estaExpirado(casamento.data_casamento, new Date()) };
}

export function atualizarDados(
  casamentoId: number,
  dados: Parameters<typeof atualizarCasamento>[1]
): void {
  atualizarCasamento(casamentoId, dados);
}
