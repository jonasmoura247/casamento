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
  return NextResponse.json({ pedido });
}
