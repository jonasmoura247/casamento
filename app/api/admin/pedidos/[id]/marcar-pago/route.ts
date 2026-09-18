// app/api/admin/pedidos/[id]/marcar-pago/route.ts
import { NextResponse } from 'next/server';
import { resolverCasamentoIdDaSessao } from '../../../../_sessao';
import { marcarPago } from '@/controllers/pedidosController';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const { id } = await params;
  try {
    marcarPago(casamentoId, Number(id));
  } catch {
    return NextResponse.json({ erro: 'Pedido nao encontrado' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
