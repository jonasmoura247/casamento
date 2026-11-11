// controllers/pedidosController.ts
import { buscarPorId as buscarPresentePorId, reservarSeDisponivel, atualizarStatus } from '../models/presentes';
import {
  criarPedido,
  buscarPedidoPorId,
  listarPedidos,
  marcarComoPago,
  anonimizarPedidosAntigos,
  type Pedido,
} from '../models/pedidos';
import { gerarPixCopiaCola, gerarQrCodeDataUrl } from '../models/pix';
import { buscarPorId as buscarCasamentoPorId, estaExpirado } from '../models/casamentos';
import { texto, ErroValidacao } from '../lib/validacao';

const MENSAGEM_MAX_LENGTH = 500;
const NOME_MAX_LENGTH = 100;

export async function criar(dados: {
  presenteId: unknown;
  nomeConvidado: unknown;
  mensagem: unknown;
}): Promise<Pedido> {
  const nomeConvidado = texto(dados.nomeConvidado, 'Seu nome', NOME_MAX_LENGTH, { obrigatorio: true });
  const mensagem = texto(dados.mensagem, 'Mensagem', MENSAGEM_MAX_LENGTH);
  if (!Number.isInteger(dados.presenteId)) throw new ErroValidacao('presente indisponivel');

  const presente = buscarPresentePorId(dados.presenteId as number);
  if (!presente || presente.status !== 'disponivel') {
    throw new ErroValidacao('presente indisponivel');
  }
  const casamento = buscarCasamentoPorId(presente.casamento_id)!;
  if (estaExpirado(casamento.data_casamento, new Date())) {
    throw new ErroValidacao('presente indisponivel');
  }

  const copiaCola = gerarPixCopiaCola({
    chave: casamento.pix_key,
    nomeRecebedor: casamento.pix_nome_recebedor,
    cidade: casamento.pix_cidade,
    valor: presente.preco,
    identificador: `PRESENTE${presente.id}`,
  });

  // Reserva antes do await do QR: duas requisições simultâneas não reservam o mesmo presente.
  if (!reservarSeDisponivel(presente.id)) throw new ErroValidacao('presente indisponivel');
  try {
    const qrCodeDataUrl = await gerarQrCodeDataUrl(copiaCola);
    return criarPedido({
      presenteId: presente.id,
      nomeConvidado,
      mensagem,
      pixCopiaCola: copiaCola,
      pixQrCodeDataUrl: qrCodeDataUrl,
    });
  } catch (erro) {
    atualizarStatus(presente.id, 'disponivel');
    throw erro;
  }
}

export function buscarStatus(id: number): Pedido | undefined {
  return buscarPedidoPorId(id);
}

export function listar(casamentoId: number): Pedido[] {
  anonimizarPedidosAntigos();
  return listarPedidos(casamentoId);
}

export function marcarPago(casamentoId: number, id: number): void {
  const pedido = buscarPedidoPorId(id);
  const presente = pedido ? buscarPresentePorId(pedido.presente_id) : undefined;
  if (!presente || presente.casamento_id !== casamentoId) {
    throw new Error('pedido nao encontrado');
  }
  marcarComoPago(id);
}
