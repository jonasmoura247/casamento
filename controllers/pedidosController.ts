// controllers/pedidosController.ts
import { buscarPorId as buscarPresentePorId } from '../models/presentes';
import { criarPedido, buscarPedidoPorId, listarPedidos, marcarComoPago, type Pedido } from '../models/pedidos';
import { gerarPixCopiaCola, gerarQrCodeDataUrl } from '../models/pix';
import { buscarPorId as buscarCasamentoPorId } from '../models/casamentos';

export async function criar(dados: {
  presenteId: number;
  nomeConvidado: string;
  mensagem: string;
}): Promise<Pedido> {
  const presente = buscarPresentePorId(dados.presenteId);
  if (!presente || presente.status !== 'disponivel') {
    throw new Error('presente indisponivel');
  }
  const casamento = buscarCasamentoPorId(presente.casamento_id)!;

  const copiaCola = gerarPixCopiaCola({
    chave: casamento.pix_key,
    nomeRecebedor: casamento.pix_nome_recebedor,
    cidade: casamento.pix_cidade,
    valor: presente.preco,
    identificador: `PRESENTE${presente.id}`,
  });
  const qrCodeDataUrl = await gerarQrCodeDataUrl(copiaCola);

  return criarPedido({
    presenteId: presente.id,
    nomeConvidado: dados.nomeConvidado,
    mensagem: dados.mensagem,
    pixCopiaCola: copiaCola,
    pixQrCodeDataUrl: qrCodeDataUrl,
  });
}

export function buscarStatus(id: number): Pedido | undefined {
  return buscarPedidoPorId(id);
}

export function listar(casamentoId: number): Pedido[] {
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
