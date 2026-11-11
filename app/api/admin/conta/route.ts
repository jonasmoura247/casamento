// app/api/admin/conta/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolverContaIdPorToken } from '@/models/sessoes';
import { buscarPorContaId } from '@/models/casamentos';
import { excluirConta } from '@/controllers/authController';

export async function DELETE() {
  const token = (await cookies()).get('sessao')?.value;
  const contaId = token && resolverContaIdPorToken(token);
  const casamento = contaId && buscarPorContaId(contaId);
  if (!contaId || !casamento) {
    return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  }
  excluirConta(contaId, casamento.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('sessao');
  return response;
}
