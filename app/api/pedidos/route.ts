// app/api/pedidos/route.ts
import { NextResponse } from 'next/server';
import { buscarPorId } from '@/models/presentes';
import { criar } from '@/controllers/pedidosController';

export async function POST(request: Request) {
  const { presenteId, nomeConvidado, mensagem } = await request.json();

  const presenteExiste = buscarPorId(presenteId);
  if (!presenteExiste) {
    return NextResponse.json({ erro: 'Presente indisponivel' }, { status: 404 });
  }

  try {
    const pedido = await criar({ presenteId, nomeConvidado, mensagem: mensagem ?? '' });
    return NextResponse.json({ pedido }, { status: 201 });
  } catch {
    return NextResponse.json({ erro: 'Presente indisponivel' }, { status: 404 });
  }
}
