// controllers/casamentosController.ts
import {
  buscarPorSlug,
  atualizarCasamento,
  estaExpirado,
  type Casamento,
} from '../models/casamentos';
import { texto, dataIso, ErroValidacao } from '../lib/validacao';

export interface EstadoPublicoCasamento {
  casamento: Casamento;
  expirado: boolean;
}

export function obterEstadoPublico(slug: string): EstadoPublicoCasamento | undefined {
  const casamento = buscarPorSlug(slug);
  if (!casamento) return undefined;
  return { casamento, expirado: estaExpirado(casamento.data_casamento, new Date()) };
}

export function atualizarDados(casamentoId: number, entrada: Record<string, unknown>): void {
  const d: Parameters<typeof atualizarCasamento>[1] = {};
  if (entrada.nomeCasal !== undefined) d.nomeCasal = texto(entrada.nomeCasal, 'Nome do casal', 100, { obrigatorio: true });
  if (entrada.dataCasamento !== undefined) d.dataCasamento = dataIso(entrada.dataCasamento, 'Data do casamento');
  if (entrada.local !== undefined) d.local = texto(entrada.local, 'Local', 200);
  if (entrada.mensagem !== undefined) d.mensagem = texto(entrada.mensagem, 'Mensagem', 500);
  if (entrada.pixKey !== undefined) d.pixKey = texto(entrada.pixKey, 'Chave Pix', 77, { obrigatorio: true });
  if (entrada.pixNomeRecebedor !== undefined) d.pixNomeRecebedor = texto(entrada.pixNomeRecebedor, 'Nome do titular da chave Pix', 25, { obrigatorio: true });
  if (entrada.pixCidade !== undefined) d.pixCidade = texto(entrada.pixCidade, 'Cidade', 15, { obrigatorio: true });
  if (entrada.mostrarContador !== undefined) {
    if (typeof entrada.mostrarContador !== 'boolean') throw new ErroValidacao('Opção do contador inválida');
    d.mostrarContador = entrada.mostrarContador;
  }
  atualizarCasamento(casamentoId, d);
}
