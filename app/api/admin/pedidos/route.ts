// app/api/admin/pedidos/route.ts
import { NextResponse } from 'next/server';
import { resolverCasamentoIdDaSessao } from '../../_sessao';
import { listar } from '@/controllers/pedidosController';

export async function GET() {
  const casamentoId = await resolverCasamentoIdDaSessao();
  if (!casamentoId) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  return NextResponse.json({ pedidos: listar(casamentoId) });
}
