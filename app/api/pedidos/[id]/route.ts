// app/api/pedidos/[id]/route.ts
import { NextResponse } from 'next/server';
import { buscarPedidoPorId } from '@/models/pedidos';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pedido = buscarPedidoPorId(Number(id));
  if (!pedido) {
    return NextResponse.json({ erro: 'Pedido nao encontrado' }, { status: 404 });
  }
  // Rota pública com ID sequencial: expõe só o status, nunca dados do convidado.
  return NextResponse.json({ pedido: { status: pedido.status } });
}
