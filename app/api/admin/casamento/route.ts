// app/api/admin/casamento/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolverContaIdPorToken } from '@/models/sessoes';
import { buscarPorContaId } from '@/models/casamentos';
import { atualizarDados } from '@/controllers/casamentosController';

export async function GET() {
  const token = (await cookies()).get('sessao')?.value;
  const contaId = token && resolverContaIdPorToken(token);
  const casamento = contaId && buscarPorContaId(contaId);
  if (!casamento) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  return NextResponse.json({ casamento });
}

export async function PATCH(request: Request) {
  const token = (await cookies()).get('sessao')?.value;
  const contaId = token && resolverContaIdPorToken(token);
  const casamento = contaId && buscarPorContaId(contaId);
  if (!casamento) return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  const dados = await request.json();
  atualizarDados(casamento.id, dados);
  return NextResponse.json({ ok: true });
}
