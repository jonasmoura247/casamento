// models/pedidos.ts
import { getDb } from './db';
import { atualizarStatus as atualizarStatusPresente } from './presentes';

export type StatusPedido = 'aguardando_pagamento' | 'pago' | 'cancelado';

export interface Pedido {
  id: number;
  presente_id: number;
  nome_convidado: string;
  mensagem: string;
  status: StatusPedido;
  pix_copia_cola: string;
  pix_qr_code_data_url: string;
  criado_em: string;
}

export function criarPedido(dados: {
  presenteId: number;
  nomeConvidado: string;
  mensagem: string;
  pixCopiaCola: string;
  pixQrCodeDataUrl: string;
}): Pedido {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO pedidos (presente_id, nome_convidado, mensagem, pix_copia_cola, pix_qr_code_data_url)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      dados.presenteId,
      dados.nomeConvidado,
      dados.mensagem,
      dados.pixCopiaCola,
      dados.pixQrCodeDataUrl
    );

  atualizarStatusPresente(dados.presenteId, 'reservado');

  return buscarPedidoPorId(Number(result.lastInsertRowid))!;
}

export function buscarPedidoPorId(id: number): Pedido | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id) as Pedido | undefined;
}

export function listarPedidos(casamentoId: number): Pedido[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT pedidos.* FROM pedidos
       JOIN presentes ON presentes.id = pedidos.presente_id
       WHERE presentes.casamento_id = ?
       ORDER BY pedidos.id DESC`
    )
    .all(casamentoId) as Pedido[];
}

export function marcarComoPago(id: number): void {
  const pedido = buscarPedidoPorId(id);
  if (!pedido) return;
  const db = getDb();
  db.prepare("UPDATE pedidos SET status = 'pago' WHERE id = ?").run(id);
  atualizarStatusPresente(pedido.presente_id, 'pago');
}

const CONDICAO_EXPIRADO = `status = 'aguardando_pagamento' AND datetime(criado_em) < datetime('now', '-1 hours')`;

export function expirarPedidosAntigos(): void {
  const db = getDb();
  db.prepare(
    `UPDATE presentes SET status = 'disponivel'
     WHERE id IN (SELECT presente_id FROM pedidos WHERE ${CONDICAO_EXPIRADO})`
  ).run();
  db.prepare(`UPDATE pedidos SET status = 'cancelado' WHERE ${CONDICAO_EXPIRADO}`).run();
}
